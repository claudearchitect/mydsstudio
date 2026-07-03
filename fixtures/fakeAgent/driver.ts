/**
 * Tiny driver that plays a FakeAgentScript against a starting BeliefState —
 * Workstream B's stand-in for Workstream C while both build in parallel
 * (V0_PLAN.md Phase 0 checklist).
 *
 * Mirrors the real turn lifecycle: each `next()` call applies the current
 * turn's patch via the real `applyPatch` (same function C's server uses)
 * and returns the resulting state plus that turn's Interaction, then
 * advances. Deterministic, synchronous, no network — safe for unit tests
 * and for driving the interaction shell in dev/demo mode.
 */
import { applyPatch, type BeliefState, type Interaction } from "@/contracts";
import type { FakeAgentScript, FakeAgentTurn } from "./types";

export interface FakeAgentStepResult {
  turn: FakeAgentTurn;
  beliefState: BeliefState;
  interaction: Interaction;
}

export class FakeAgentDriver {
  private cursor = 0;

  constructor(
    private script: FakeAgentScript,
    private state: BeliefState,
  ) {}

  get done(): boolean {
    return this.cursor >= this.script.turns.length;
  }

  get currentState(): BeliefState {
    return this.state;
  }

  /** Applies the next scripted turn's patch and returns the new state +
   * interaction. Throws if the script is exhausted. */
  next(): FakeAgentStepResult {
    if (this.done) {
      throw new Error(
        `FakeAgentDriver: script "${this.script.name}" is exhausted (${this.script.turns.length} turns played)`,
      );
    }
    const turn = this.script.turns[this.cursor];
    const eventId = `fake-${turn.id}`;
    this.state = applyPatch(this.state, turn.patch, eventId);
    this.cursor += 1;
    return { turn, beliefState: this.state, interaction: turn.interaction };
  }

  reset(state: BeliefState): void {
    this.cursor = 0;
    this.state = state;
  }
}
