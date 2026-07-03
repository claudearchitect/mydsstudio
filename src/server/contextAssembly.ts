/**
 * Context assembly (V0_PLAN.md Workstream C: "assemble context (system +
 * full belief state + event tail)"; IMPLEMENTATION.md #3: "The server
 * assembles: 1. System prompt ... 2. The full belief state ... 3. Event log
 * tail ... 4. The instruction: choose your next action.").
 *
 * Conversation shape (why it looks the way it does):
 *  - The interview is replayed as a real user/assistant conversation: each
 *    turn the user actually said something (their answer, a pick, a control
 *    tweak) is a `user` message, and each of the model's turns is an
 *    `assistant` message carrying its two tool_use blocks. This is what lets
 *    the model see the user's *own words* on every turn — not just its own
 *    past questions. (Before this, only the belief state + the current
 *    message were sent, so the model was blind to every earlier answer, and
 *    the "contradiction → clarify" interview rule could only fire on the
 *    current turn.)
 *  - The very first user message is the kickoff instruction (there was no
 *    real user input yet); it prompts the model's opening question.
 *
 * Prompt-cache hygiene (AGENTS.md "Claude API rules"):
 *  - `system` is always exactly one block: the byte-identical SYSTEM_PROMPT
 *    with `cache_control: {type: "ephemeral"}` on it.
 *  - The conversation prefix is *append-only and byte-stable*: a turn's user
 *    message carries the user's answer as its own text block, and the
 *    turn-varying belief-state/event-tail/instruction goes in a SEPARATE
 *    trailing block that only ever exists on the newest message. The second
 *    cache breakpoint sits on the newest user *answer* block, so everything
 *    up to and including the whole conversation history caches, and only the
 *    volatile belief block (which never recurs) trails uncached. When a turn
 *    becomes historical next turn, its belief block is simply dropped — it
 *    was always after the breakpoint, so the cached prefix is unaffected and
 *    stays readable turn over turn (verify with usage.cache_read_input_tokens).
 *  - Tool-result acks for a turn's tool_use blocks are folded into the *next*
 *    user message (the API requires each tool_use to be immediately followed
 *    by its tool_result in the next message, and forbids two adjacent
 *    same-role messages).
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { BeliefState, Interaction, TokenPatch } from "@/contracts";
import { TOOL_NAMES } from "@/contracts";
import { SYSTEM_PROMPT } from "./systemPrompt";
import { summarizeEventLog } from "./eventLog";

/** The kickoff instruction for a brand-new session (V0_PLAN.md: "a new
 * session posts a session_start event with an empty log — the agent's first
 * turn asks the opening question ... No hardcoded first question; the model
 * owns the interview from turn one."). This is NOT a first question — it is
 * an instruction to the model to produce one. Lives here (rather than in
 * turnRunner) because assembly needs it to render the first user message of a
 * replayed conversation; turnRunner re-exports it for the route/CLI. */
export const KICKOFF_INSTRUCTION =
  "This is a brand-new session. No product, audience, or design signal has been captured yet. Begin the interview: call update_beliefs with an empty patch (there is nothing to commit yet) and call interact with mode \"ask\" to pose your opening question — what they're building and who it's for is the standard opening, but phrase it in your own words.";

/** One prior turn's tool calls + the user text that prompted it, replayed
 * verbatim on subsequent requests so the assistant's own history stays
 * coherent and the model sees the user's actual answers. Mirrors exactly what
 * `turnRunner.ts` sent to the model and what it appended after applying the
 * patch. */
export interface PriorTurnRecord {
  /** The assistant message containing exactly the two tool_use blocks the
   * model emitted (update_beliefs + interact), in that order. */
  updateBeliefsInput: TokenPatch;
  interactInput: Interaction;
  updateBeliefsToolUseId: string;
  interactToolUseId: string;
  /** The already-rendered user-facing text that prompted THIS turn — the
   * user's answer/pick/tweak, or the kickoff instruction for turn one. Empty
   * string is treated as the kickoff (assembly substitutes
   * KICKOFF_INSTRUCTION), which is what the client stores for its null
   * kickoff message. */
  userText: string;
}

export interface AssembleContextInput {
  beliefState: BeliefState;
  /** The newest user-facing input for this turn: either a normalized
   * message from the user (already rendered to text), or the kickoff
   * instruction for a brand-new session with no prior user input yet. */
  latestUserText: string;
  /** All turns already played in this session, oldest first. Empty for the
   * very first (kickoff) turn. */
  priorTurns: PriorTurnRecord[];
}

export interface AssembledContext {
  system: Anthropic.MessageCreateParams["system"];
  messages: Anthropic.MessageParam[];
}

const EPHEMERAL: Anthropic.CacheControlEphemeral = { type: "ephemeral" };

/**
 * Builds the exact `system` + `messages` payload for one turn.
 *
 * `system` is byte-identical across every call (same string, same single
 * block, same cache_control). The `messages` array is an append-only replay
 * of the whole conversation, with the volatile belief block trailing the
 * newest user message behind the cache breakpoint.
 */
export function assembleContext(input: AssembleContextInput): AssembledContext {
  const { beliefState, latestUserText, priorTurns } = input;

  const system: Anthropic.MessageCreateParams["system"] = [
    {
      type: "text",
      text: SYSTEM_PROMPT,
      cache_control: EPHEMERAL,
    },
  ];

  const messages: Anthropic.MessageParam[] = [];

  // Kickoff turn: a single user message carrying the kickoff instruction plus
  // the belief block. There is no prior conversation to replay.
  if (priorTurns.length === 0) {
    messages.push({
      role: "user",
      content: newestUserContent([], latestUserText, beliefState),
    });
    return { system, messages };
  }

  // The first user message is whatever prompted the model's very first
  // (kickoff) turn — always the kickoff instruction.
  messages.push({
    role: "user",
    content: [userAnswerBlock(priorTurns[0].userText || KICKOFF_INSTRUCTION, false)],
  });

  for (const [index, turn] of priorTurns.entries()) {
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

    const acks: Anthropic.ToolResultBlockParam[] = [
      { type: "tool_result", tool_use_id: turn.updateBeliefsToolUseId, content: "applied" },
      { type: "tool_result", tool_use_id: turn.interactToolUseId, content: "delivered to user" },
    ];

    const isLastPriorTurn = index === priorTurns.length - 1;
    if (isLastPriorTurn) {
      // The newest user message: this turn's real input + the volatile belief
      // block, behind the cache breakpoint.
      messages.push({
        role: "user",
        content: newestUserContent(acks, latestUserText, beliefState),
      });
    } else {
      // A historical user message: the answer that prompted the NEXT
      // assistant turn, byte-identical to how it was sent when that turn was
      // newest (no belief block, no cache_control).
      const nextText = priorTurns[index + 1].userText;
      messages.push({
        role: "user",
        content: [...acks, userAnswerBlock(nextText, false)],
      });
    }
  }

  return { system, messages };
}

/** The user's own text for a turn, as its own content block. `cacheable`
 * marks the newest turn's answer block with the second cache breakpoint —
 * historical replays of the same block are byte-identical (cache_control is
 * request metadata, not tokenized content). */
function userAnswerBlock(text: string, cacheable: boolean): Anthropic.TextBlockParam {
  return cacheable
    ? { type: "text", text, cache_control: EPHEMERAL }
    : { type: "text", text };
}

/** The newest user message's content: any tool-result acks for the previous
 * turn, then this turn's answer (with the cache breakpoint), then the
 * volatile belief block. The belief block is deliberately last and uncached —
 * it never recurs, so caching it would waste a write, and dropping it from the
 * historical replay next turn leaves the cached prefix untouched. */
function newestUserContent(
  acks: Anthropic.ToolResultBlockParam[],
  latestUserText: string,
  state: BeliefState,
): Anthropic.ContentBlockParam[] {
  return [
    ...acks,
    userAnswerBlock(latestUserText, true),
    { type: "text", text: buildBeliefBlock(state) },
  ];
}

/**
 * Serializes the belief state + event tail + the choose-your-action
 * instruction into the trailing (volatile) block of the newest user message.
 * Deterministic JSON.stringify (stable key order from the Zod-typed object
 * shapes) — see contracts/beliefState.ts. Note this block carries the model's
 * *own recorded actions* (the event log); the user's answers live in the
 * conversation's user messages, not here.
 */
function buildBeliefBlock(state: BeliefState): string {
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
    "## Event log tail (your own recorded actions)",
    summary ? summary : "(full event log below — under the summarization threshold)",
    "```json",
    JSON.stringify(verbatim, null, 2),
    "```",
    "",
    "Choose your next action: call `update_beliefs` (patch may be empty) and exactly one of `interact` or `export_design_md`, in parallel, per the protocol in your system prompt.",
  ];

  return sections.join("\n");
}
