/**
 * Context assembly (V0_PLAN.md Workstream C: "assemble context (system +
 * full belief state + event tail)"; IMPLEMENTATION.md #3: "The server
 * assembles: 1. System prompt ... 2. The full belief state ... 3. Event log
 * tail ... 4. The instruction: choose your next action.").
 *
 * Prompt-cache hygiene (AGENTS.md "Claude API rules"):
 *  - `system` is always exactly one block: the byte-identical SYSTEM_PROMPT
 *    with `cache_control: {type: "ephemeral"}` on it (it's also the LAST
 *    system block, trivially, since there's only one).
 *  - The turn-varying payload (belief state + event tail + instruction)
 *    goes in the newest user message, with `cache_control` on its last
 *    content block (second breakpoint per AGENTS.md).
 *  - Tool ack messages (previous turn's tool_use + tool_result) are replayed
 *    verbatim ahead of the new user turn so the model's own prior turn
 *    stays in context and the conversation-level cache prefix is preserved
 *    turn over turn.
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { BeliefState, Interaction, TokenPatch } from "@/contracts";
import { TOOL_NAMES } from "@/contracts";
import { SYSTEM_PROMPT } from "./systemPrompt";
import { summarizeEventLog } from "./eventLog";

/** One prior turn's tool calls + the acked tool results, replayed verbatim
 * on subsequent requests so the assistant's own history stays coherent.
 * Mirrors exactly what `turnRunner.ts` sent to the model and what it
 * appended after applying the patch. */
export interface PriorTurnRecord {
  /** The assistant message containing exactly the two tool_use blocks the
   * model emitted (update_beliefs + interact), in that order. */
  updateBeliefsInput: TokenPatch;
  interactInput: Interaction;
  updateBeliefsToolUseId: string;
  interactToolUseId: string;
  /** Anthropic-side ids for provenance/debugging only; not required by the
   * API but useful for building the assistant content block deterministically. */
}

export interface AssembleContextInput {
  beliefState: BeliefState;
  /** The newest user-facing input for this turn: either a normalized
   * message from the user, or the kickoff instruction for a brand-new
   * session with no prior user input yet. */
  latestUserText: string;
  /** All turns already played in this session, oldest first. Empty for the
   * very first (kickoff) turn. */
  priorTurns: PriorTurnRecord[];
}

export interface AssembledContext {
  system: Anthropic.MessageCreateParams["system"];
  messages: Anthropic.MessageParam[];
}

/**
 * Builds the exact `system` + `messages` payload for one turn.
 *
 * `system` is byte-identical across every call (same string, same single
 * block, same cache_control) — this is what the byte-stability test
 * asserts. Everything that varies by turn lives in `messages`.
 */
export function assembleContext(input: AssembleContextInput): AssembledContext {
  const { beliefState, latestUserText, priorTurns } = input;

  const system: Anthropic.MessageCreateParams["system"] = [
    {
      type: "text",
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    },
  ];

  const messages: Anthropic.MessageParam[] = [];

  // Replay prior turns as real assistant/user tool_use <-> tool_result
  // pairs so the model sees its own history exactly as it produced it,
  // rather than re-summarizing prior turns into prose (which would both
  // lose information and break the cached prefix every time).
  for (const turn of priorTurns) {
    messages.push({
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: turn.updateBeliefsToolUseId,
          name: TOOL_NAMES.updateBeliefs,
          input: { patch: turn.updateBeliefsInput },
        },
        {
          type: "tool_use",
          id: turn.interactToolUseId,
          name: TOOL_NAMES.interact,
          input: turn.interactInput,
        },
      ],
    });
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: turn.updateBeliefsToolUseId,
          content: "applied",
        },
        {
          type: "tool_result",
          tool_use_id: turn.interactToolUseId,
          content: "delivered to user",
        },
      ],
    });
  }

  const turnPayload = buildTurnPayloadText(beliefState, latestUserText);

  messages.push({
    role: "user",
    content: [
      {
        type: "text",
        text: turnPayload,
        cache_control: { type: "ephemeral" },
      },
    ],
  });

  return { system, messages };
}

/**
 * Serializes the belief state + event tail + latest input into the text
 * block for the newest user message. Deterministic JSON.stringify (stable
 * key order comes from the Zod-typed object shapes, which are always
 * constructed in the same field order) — see contracts/beliefState.ts.
 */
function buildTurnPayloadText(state: BeliefState, latestUserText: string): string {
  const { verbatim, summary } = summarizeEventLog(state.events);

  const stateForPrompt = {
    schemaVersion: state.schemaVersion,
    meta: state.meta,
    groups: state.groups,
    rationale: state.rationale,
  };

  const sections = [
    "## Current belief state (groups, rationale)",
    "```json",
    JSON.stringify(stateForPrompt, null, 2),
    "```",
    "",
    "## Event log tail",
    summary ? summary : "(full event log below — under the summarization threshold)",
    "```json",
    JSON.stringify(verbatim, null, 2),
    "```",
    "",
    "## Latest input",
    latestUserText,
    "",
    "Choose your next action: call `update_beliefs` (patch may be empty) and exactly one of `interact` or `export_design_md`, in parallel, per the protocol in your system prompt.",
  ];

  return sections.join("\n");
}
