/**
 * TurnAgent — the interface the shell drives a turn through. In this phase
 * the only implementation is the fake-agent adapter (fixtures/fakeAgent),
 * standing in for Workstream C's real `/api/turn` (wired in Phase 2 per
 * V0_PLAN.md: "wire real /api/turn is Phase 2"). Keeping this seam narrow
 * means swapping in the real SSE-backed client later touches only
 * `realTurnAgent.ts`, not the session hook or any UI.
 *
 * A turn always produces: zero or more `delta` text chunks, then exactly
 * one terminal result — either a settled `{beliefState, interaction}` or an
 * `error`. This mirrors the frozen wire format (turnWireFormat.ts) even
 * though the fake agent never touches the network.
 */
import type { BeliefState, Interaction, NormalizedMessage, TurnErrorCode } from "@/contracts";

export interface TurnAgentSuccess {
  kind: "success";
  beliefState: BeliefState;
  interaction: Interaction;
  /** True iff this turn ended in confident completion (the model called
   * `export_design_md` rather than `interact`) — see turnWireFormat.ts's
   * `TurnFinalEvent.completed`. Defaults to false for adapters that have no
   * notion of it (e.g. a fake-agent script whose every turn is an
   * ordinary interact). */
  completed?: boolean;
}

export interface TurnAgentError {
  kind: "error";
  code: TurnErrorCode;
  message: string;
}

export type TurnAgentResult = TurnAgentSuccess | TurnAgentError;

export interface TurnAgentCallbacks {
  onDelta?: (text: string) => void;
}

/** Runs one turn given the message the user just sent (or null for the
 * session-kickoff turn, which has no user message yet) and the current
 * belief state. Implementations may ignore `message`/`state` (the fake
 * agent does — it just plays back its script) but real agents need both. */
export interface TurnAgent {
  runTurn(
    message: NormalizedMessage | null,
    state: BeliefState,
    callbacks?: TurnAgentCallbacks,
  ): Promise<TurnAgentResult>;
  /** True once the agent has no more turns to produce (fake-agent script
   * exhausted). Real agents are inexhaustible — always false. */
  readonly exhausted: boolean;
}
