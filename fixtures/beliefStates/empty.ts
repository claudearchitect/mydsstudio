/**
 * Fixture: the initial "empty session" belief state (V0_PLAN.md Phase 0
 * checklist). This is exactly what `session_start` produces before the
 * agent's first turn — no groups touched, no rationale, one event.
 */
import type { BeliefState } from "@/contracts";

export const emptyBeliefState: BeliefState = {
  schemaVersion: 1,
  meta: { product: "", audience: "", personality: [] },
  groups: {},
  rationale: [],
  events: [
    {
      id: "e00",
      ts: "2026-07-03T00:00:00.000Z",
      kind: "session_start",
      payload: {},
    },
  ],
};
