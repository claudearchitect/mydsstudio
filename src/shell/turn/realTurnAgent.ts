/**
 * Real TurnAgent adapter — wires the shell to Workstream C's `POST
 * /api/turn` (V0_PLAN.md Phase 2: "Wire B's channels to C's `/api/turn`.
 * Replace/augment B's fake-agent turn adapter with a real one that POSTs
 * the event and consumes the SSE stream via `consumeTurnStream`").
 *
 * Owns no belief state itself — mirrors FakeTurnAgent's shape (turnAgent.ts)
 * so `useSession` never has to know which implementation it's driving.
 * Session-scoped bookkeeping the server needs across turns (the running
 * `priorTurns` list and `turnIndex`) lives here, keyed by a fresh instance
 * per session (Session.tsx constructs one per mount/session-reset).
 *
 * `/api/turn` is stateless per request (src/server/requestSchema.ts: "the
 * caller is responsible for holding session state ... between calls") —
 * this adapter is that caller-side state. Each turn's `PriorTurnRecord` is
 * built directly from the wire event's `patch`/`interaction` fields (added
 * to `TurnFinalEventSchema` specifically to make this possible — see
 * turnWireFormat.ts's doc comment on the `patch` field), the same values
 * `contextAssembly.ts` replays verbatim as the model's own prior tool_use
 * content on the next call.
 */
import {
  consumeTurnStream,
  type BeliefState,
  type NormalizedMessage,
  type TurnErrorCode,
} from "@/contracts";
import type { TurnAgent, TurnAgentCallbacks, TurnAgentResult } from "./turnAgent";

/** Mirrors src/server/requestSchema.ts's PriorTurnRecordSchema — duplicated
 * here (rather than imported) because src/server/ is server-only code the
 * client bundle must never pull in (it transitively reaches
 * anthropicClient.ts, which reads process.env.ANTHROPIC_API_KEY). Shape is
 * part of the /api/turn request contract, not a frozen src/contracts/ type,
 * so a small client-side mirror is the correct boundary. */
export interface PriorTurnRecord {
  updateBeliefsInput: unknown;
  interactInput: unknown;
  updateBeliefsToolUseId: string;
  interactToolUseId: string;
  /** The rendered user text that prompted this turn — replayed as its user
   * message on the next request so the model sees the user's own words. Empty
   * for the kickoff turn (the server substitutes the kickoff instruction). */
  userText: string;
}

const KICKOFF_INSTRUCTION_MESSAGE = null;

/** Renders a NormalizedMessage to the same plain text the server produces
 * (src/server/requestSchema.ts `renderNormalizedMessageText`). Duplicated
 * rather than imported for the same server/client boundary reason as
 * `PriorTurnRecord` above — src/server/ transitively reaches the API-key
 * path. Must stay byte-identical to the server's renderer, or a turn's
 * replayed history diverges from its live text and misses the prompt cache
 * (correctness is unaffected either way). `messageRenderMatchesServer` in the
 * tests pins the two together. */
export function renderUserText(message: NormalizedMessage | null): string {
  if (message === null) return ""; // kickoff — server substitutes KICKOFF_INSTRUCTION
  switch (message.channel) {
    case "chat":
      return message.text;
    case "region":
      return [
        `[region comment on ${message.target}]`,
        `tokens in scope: ${JSON.stringify(message.tokensInScope)}`,
        message.text,
      ].join("\n");
    case "control":
      return `[control] ${message.text}`;
  }
}

export class RealTurnAgent implements TurnAgent {
  private priorTurns: PriorTurnRecord[] = [];
  private turnIndex = 1;

  /** Real agents are inexhaustible — always false (turnAgent.ts). */
  readonly exhausted = false;

  async runTurn(
    message: NormalizedMessage | null,
    state: BeliefState,
    callbacks?: TurnAgentCallbacks,
  ): Promise<TurnAgentResult> {
    const body = {
      beliefState: state,
      message: message ?? KICKOFF_INSTRUCTION_MESSAGE,
      priorTurns: this.priorTurns,
      turnIndex: this.turnIndex,
    };

    let response: Response;
    try {
      response = await fetch("/api/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      return {
        kind: "error",
        code: "network_error",
        message: err instanceof Error ? err.message : "Network request to /api/turn failed.",
      };
    }

    if (!response.body) {
      return {
        kind: "error",
        code: "unknown",
        message: "/api/turn returned no response body.",
      };
    }

    try {
      for await (const event of consumeTurnStream(response.body)) {
        if (event.type === "delta") {
          callbacks?.onDelta?.(event.text);
          continue;
        }
        if (event.type === "error") {
          return { kind: "error", code: event.code, message: event.message };
        }
        // event.type === "turn" — terminal, success. The tool_use ids are
        // this adapter's own bookkeeping (any stable, unique-per-turn string
        // works — the server only needs them to pair each tool_use with its
        // tool_result when replaying, not to match any id Claude itself
        // issued) — see contextAssembly.ts's replay, which builds fresh
        // assistant/user message pairs from these fields on every turn
        // regardless of what id scheme produced them.
        const completedTurnIndex = this.turnIndex;
        this.turnIndex += 1;
        // Don't record an export turn: the server returns no replayable
        // interact for it (it called export_design_md, not interact), so
        // fabricating a record here would replay a question the model never
        // asked. Matches turnRunner.ts, which returns no priorTurnRecord for
        // an export turn.
        if (!event.completed) {
          this.priorTurns.push({
            updateBeliefsInput: event.patch,
            interactInput: event.interaction,
            updateBeliefsToolUseId: `turn-${completedTurnIndex}-update_beliefs`,
            interactToolUseId: `turn-${completedTurnIndex}-interact`,
            userText: renderUserText(message),
          });
        }
        return {
          kind: "success",
          beliefState: event.beliefState,
          interaction: event.interaction,
          completed: event.completed,
        };
      }
    } catch (err) {
      return {
        kind: "error",
        code: mapStreamErrorToCode(err),
        message: err instanceof Error ? err.message : "Failed to read /api/turn stream.",
      };
    }

    return {
      kind: "error",
      code: "unknown",
      message: "/api/turn stream ended without a terminal event.",
    };
  }

  /** Resets per-session bookkeeping (used when the user starts a fresh
   * session, e.g. "start over" — kept for completeness even though V0 has
   * no such affordance yet beyond a full page reload). */
  reset(): void {
    this.priorTurns = [];
    this.turnIndex = 1;
  }
}

function mapStreamErrorToCode(err: unknown): TurnErrorCode {
  if (err instanceof TypeError) return "network_error";
  return "unknown";
}
