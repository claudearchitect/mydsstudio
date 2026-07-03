/**
 * Fake-agent turn format (V0_PLAN.md Phase 0 checklist: "a fixture file of
 * {update_beliefs, interact} pairs + a tiny driver that plays them — B's
 * stand-in for C").
 *
 * Each FakeAgentTurn mirrors exactly what a real turn produces: one
 * TokenPatch (the `update_beliefs` tool input) and one Interaction (the
 * `interact` tool input). The driver in `driver.ts` applies patches via the
 * real `applyPatch` and emits interactions in order, so anything built
 * against the driver is exercising the same code path it'll use against
 * Workstream C's real `/api/turn` later — only the source of turns differs.
 */
import type { TokenPatch, Interaction } from "@/contracts";

export interface FakeAgentTurn {
  id: string;
  /** Optional: NL text this turn would have streamed as `delta` events,
   * for exercising chat-panel streaming UI against the fake agent. */
  deltaText?: string;
  patch: TokenPatch;
  interaction: Interaction;
}

export interface FakeAgentScript {
  name: string;
  turns: FakeAgentTurn[];
}
