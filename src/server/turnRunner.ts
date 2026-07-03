/**
 * The agent loop's core orchestration (V0_PLAN.md Workstream C: "Route
 * handler POST /api/turn: assemble context ... call Claude streaming
 * (max_tokens: 16000), emit the SSE events ... apply patch server-side").
 *
 * This is intentionally NOT a tool-runner loop (V0_PLAN.md "Turn shape":
 * "one API call per turn — no tool-runner loop"; AGENTS.md: "Don't build a
 * multi-step tool-runner loop"). One turn = one Claude call, with at most
 * one corrective retry on a protocol violation
 * (V0_PLAN.md: "one corrective retry on violation, then an error SSE event").
 *
 * Framework-agnostic: takes an injected `AnthropicMessagesClient` and a
 * callback to emit wire-format events, so it's usable from both the Next.js
 * route handler and the CLI harness, and testable with a mock client and no
 * network calls.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { applyPatch, type BeliefState, type BeliefEvent, type TurnStreamEvent, type TurnUsage } from "@/contracts";
import type { AnthropicMessagesClient } from "./anthropicClient";
import { assembleContext, KICKOFF_INSTRUCTION, type PriorTurnRecord } from "./contextAssembly";
import { buildAnthropicTools } from "./tools";
import {
  validateTurnToolCalls,
  buildCorrectiveRetryText,
  type ValidTurnToolCalls,
} from "./protocolValidation";
import { mapErrorToTurnError } from "./errorMapping";
import { nextEventIdForState } from "./eventLog";
import { buildTurnLogEntry, logTurn } from "./logging";

// KICKOFF_INSTRUCTION lives in contextAssembly (assembly needs it to render
// the first user message of a replayed conversation); re-exported here so the
// route handler and CLI keep importing it from turnRunner as before.
export { KICKOFF_INSTRUCTION };

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 16000;

export interface RunTurnInput {
  client: AnthropicMessagesClient;
  beliefState: BeliefState;
  /** The normalized text describing the latest user input for this turn.
   * For the kickoff turn (a fresh session_start with no prior user input),
   * pass the kickoff instruction text — see `buildKickoffInstruction()`. */
  latestUserText: string;
  priorTurns: PriorTurnRecord[];
  /** 1-based index of this turn within the session, for logging only. */
  turnIndex: number;
  /** Session-scoped seed for event ids, so ids stay unique and readable
   * across a session without a UUID dependency (see eventLog.ts). */
  eventIdSeed?: string;
  /** Called for every SSE event this turn produces, in order. The route
   * handler wires this to `formatSseEvent` + stream writes; the CLI
   * harness wires it to a local event handler. */
  onEvent: (event: TurnStreamEvent) => void;
}

export interface RunTurnResult {
  /** The belief state after this turn's patch has been applied. Equal to
   * the input state if the turn ended in an unrecoverable error. */
  beliefState: BeliefState;
  /** Present iff the turn succeeded (protocol satisfied, patch applied). */
  toolCalls?: ValidTurnToolCalls;
  /** The PriorTurnRecord to append to `priorTurns` for the *next* call to
   * runTurn, if this turn succeeded and was an interact (not an export). */
  priorTurnRecord?: PriorTurnRecord;
  /** True if the turn ended by emitting an `error` event. */
  failed: boolean;
}

export async function runTurn(input: RunTurnInput): Promise<RunTurnResult> {
  const { client, beliefState, latestUserText, priorTurns, turnIndex, onEvent } = input;
  const seed = input.eventIdSeed ?? "e";

  const context = assembleContext({ beliefState, latestUserText, priorTurns });
  const tools = buildAnthropicTools();

  const attempt = await attemptTurn({
    client,
    system: context.system,
    messages: context.messages,
    tools,
    turnIndex,
    retried: false,
    onEvent,
  });

  if (attempt.kind === "api_error") {
    onEvent({ type: "error", code: attempt.error.code, message: attempt.error.message });
    return { beliefState, failed: true };
  }

  if (attempt.kind === "protocol_error") {
    // One corrective retry: replay the same context plus the assistant's
    // invalid tool calls (so it can see what it did wrong) plus a user
    // turn naming the violation, then try once more.
    //
    // The Anthropic API requires every tool_use block in an assistant
    // message to be immediately followed, in the very next message, by a
    // matching tool_result block — a plain-text-only user turn after an
    // assistant message containing tool_use blocks is rejected with a 400
    // ("tool_use ids were found without tool_result blocks immediately
    // after"), discovered live on the very first protocol-violation retry.
    // Emit an error tool_result for each tool_use block the assistant
    // produced (there's nothing to "apply" — the turn was rejected) ahead
    // of the corrective-retry text, in the same user message.
    const toolResultAcks: Anthropic.ToolResultBlockParam[] = attempt.rawContent
      .filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use")
      .map((block) => ({
        type: "tool_result",
        tool_use_id: block.id,
        content: "Turn rejected: protocol violation — see the following message.",
        is_error: true,
      }));

    const retryMessages: Anthropic.MessageParam[] = [
      ...context.messages,
      { role: "assistant", content: attempt.rawContent },
      {
        role: "user",
        content: [
          ...toolResultAcks,
          { type: "text", text: buildCorrectiveRetryText(attempt.reason) },
        ],
      },
    ];

    const retryAttempt = await attemptTurn({
      client,
      system: context.system,
      messages: retryMessages,
      tools,
      turnIndex,
      retried: true,
      onEvent,
    });

    if (retryAttempt.kind === "api_error") {
      onEvent({ type: "error", code: retryAttempt.error.code, message: retryAttempt.error.message });
      return { beliefState, failed: true };
    }

    if (retryAttempt.kind === "protocol_error") {
      onEvent({
        type: "error",
        code: "protocol_violation",
        message: `Model failed to follow the turn protocol after one corrective retry: ${retryAttempt.reason}`,
      });
      return { beliefState, failed: true };
    }

    return finalizeSuccessfulTurn({
      toolCalls: retryAttempt.toolCalls,
      beliefState,
      latestUserText,
      seed,
      onEvent,
      usage: retryAttempt.usage,
    });
  }

  return finalizeSuccessfulTurn({
    toolCalls: attempt.toolCalls,
    beliefState,
    latestUserText,
    seed,
    onEvent,
    usage: attempt.usage,
  });
}

type AttemptResult =
  | { kind: "success"; toolCalls: ValidTurnToolCalls; usage: Anthropic.Usage }
  | { kind: "protocol_error"; reason: string; rawContent: Anthropic.ContentBlock[] }
  | { kind: "api_error"; error: { code: import("@/contracts").TurnErrorCode; message: string } };

/** Runs a single API call (no retry logic here — that's the caller's job)
 * and streams `delta` events for the NL text of the `interact` tool call as
 * it arrives. */
async function attemptTurn(params: {
  client: AnthropicMessagesClient;
  system: Anthropic.MessageCreateParams["system"];
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
  turnIndex: number;
  retried: boolean;
  onEvent: (event: TurnStreamEvent) => void;
}): Promise<AttemptResult> {
  const { client, system, messages, tools, turnIndex, retried, onEvent } = params;
  const startedAt = Date.now();

  let finalMessage: Anthropic.Message;
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system,
      messages,
      tools,
    });

    stream.on("text", (delta: string) => {
      onEvent({ type: "delta", text: delta });
    });

    finalMessage = await stream.finalMessage();
  } catch (err) {
    return { kind: "api_error", error: mapErrorToTurnError(err) };
  }

  const latencyMs = Date.now() - startedAt;
  logTurn(
    buildTurnLogEntry({
      turnIndex,
      latencyMs,
      usage: finalMessage.usage,
      retried,
      stopReason: finalMessage.stop_reason,
    }),
  );

  const validation = validateTurnToolCalls(finalMessage.content);
  if (!validation.ok) {
    return { kind: "protocol_error", reason: validation.reason, rawContent: finalMessage.content };
  }

  return { kind: "success", toolCalls: validation, usage: finalMessage.usage };
}

function finalizeSuccessfulTurn(params: {
  toolCalls: ValidTurnToolCalls;
  beliefState: BeliefState;
  latestUserText: string;
  seed: string;
  usage: Anthropic.Usage;
  onEvent: (event: TurnStreamEvent) => void;
}): RunTurnResult {
  const { toolCalls, beliefState, latestUserText, seed, usage, onEvent } = params;

  // Event ids are derived from the state's existing log (not a process
  // counter) so they stay unique across restarts and resumed sessions — see
  // eventLog.ts.
  const eventId = nextEventIdForState(beliefState.events, seed);
  const patchedState = applyPatch(beliefState, toolCalls.updateBeliefs.patch, eventId);

  const newEvents: BeliefEvent[] = [
    ...patchedState.events,
    {
      id: eventId,
      ts: new Date().toISOString(),
      kind: "update_beliefs",
      payload: toolCalls.updateBeliefs.patch,
    },
  ];

  let interactionForWire: import("@/contracts").Interaction;
  const completed = Boolean(toolCalls.exportDesignMd);
  if (toolCalls.interact) {
    const interactEventId = nextEventIdForState(newEvents, seed);
    newEvents.push({
      id: interactEventId,
      ts: new Date().toISOString(),
      kind: "interact",
      payload: toolCalls.interact.interaction,
    });
    interactionForWire = toolCalls.interact.interaction;
  } else if (toolCalls.exportDesignMd) {
    const exportEventId = nextEventIdForState(newEvents, seed);
    newEvents.push({
      id: exportEventId,
      ts: new Date().toISOString(),
      kind: "export_design_md",
      payload: {},
    });
    // The turn wire format's `turn` event requires an `interaction` field
    // (IMPLEMENTATION.md #3: interact is the visible per-turn UI action).
    // When the model calls export_design_md instead, synthesize a minimal
    // ask-shaped interaction so the client still has something to render
    // (a completion acknowledgement) — export delivery itself is handled
    // by Workstream D's export UI reading the belief state, not by this
    // synthesized interaction.
    interactionForWire = {
      mode: "ask",
      question: "Your design.md is ready. Would you like to keep refining, or is this good?",
      quickReplies: [],
    };
  } else {
    // Unreachable: validateTurnToolCalls guarantees interact XOR exportDesignMd.
    throw new Error("finalizeSuccessfulTurn: neither interact nor exportDesignMd present");
  }

  const finalState: BeliefState = { ...patchedState, events: newEvents };

  const turnUsage: TurnUsage = {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
  };

  onEvent({
    type: "turn",
    beliefState: finalState,
    interaction: interactionForWire,
    usage: turnUsage,
    patch: toolCalls.updateBeliefs.patch,
    completed,
  });

  const priorTurnRecord: PriorTurnRecord | undefined = toolCalls.interact
    ? {
      updateBeliefsInput: toolCalls.updateBeliefs.patch,
      interactInput: toolCalls.interact.interaction,
      updateBeliefsToolUseId: toolCalls.updateBeliefs.toolUseId,
      interactToolUseId: toolCalls.interact.toolUseId,
      // The text that prompted this turn — replayed as this turn's user
      // message on the next request so the model sees the user's own words.
      userText: latestUserText,
    }
    : undefined;

  return { beliefState: finalState, toolCalls, priorTurnRecord, failed: false };
}
