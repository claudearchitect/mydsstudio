/**
 * Fake-agent TurnAgent adapter — wraps `FakeAgentDriver` (fixtures/fakeAgent)
 * behind the `TurnAgent` interface so the session hook can drive turns
 * without knowing whether it's talking to the fake driver or (Phase 2) the
 * real `/api/turn` SSE stream.
 *
 * Simulates the wire format's latency-masking shape (IMPLEMENTATION.md #7):
 * streams `deltaText` in word-sized chunks via `onDelta` before resolving
 * with the settled state/interaction, so the chat panel's streaming UI has
 * something real to exercise in dev/demo mode and in tests.
 */
import type { FakeAgentDriver } from "@fixtures/fakeAgent";
import type { BeliefState, NormalizedMessage } from "@/contracts";
import type { TurnAgent, TurnAgentCallbacks, TurnAgentResult } from "./turnAgent";

export interface FakeTurnAgentOptions {
  /** ms delay between streamed delta chunks; 0 for instant (tests). */
  deltaIntervalMs?: number;
}

export class FakeTurnAgent implements TurnAgent {
  constructor(
    private driver: FakeAgentDriver,
    private options: FakeTurnAgentOptions = {},
  ) {}

  get exhausted(): boolean {
    return this.driver.done;
  }

  async runTurn(
    _message: NormalizedMessage | null,
    _state: BeliefState,
    callbacks?: TurnAgentCallbacks,
  ): Promise<TurnAgentResult> {
    if (this.driver.done) {
      return {
        kind: "error",
        code: "unknown",
        message: "fake-agent script exhausted — no more scripted turns",
      };
    }

    const step = this.driver.next();

    if (callbacks?.onDelta && step.turn.deltaText) {
      const words = step.turn.deltaText.split(" ");
      const intervalMs = this.options.deltaIntervalMs ?? 0;
      for (const word of words) {
        callbacks.onDelta(word + " ");
        if (intervalMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      }
    }

    return {
      kind: "success",
      beliefState: step.beliefState,
      interaction: step.interaction,
      completed: step.completed,
    };
  }
}
