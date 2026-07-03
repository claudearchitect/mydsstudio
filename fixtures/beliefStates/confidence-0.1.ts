/**
 * Fixture: ~0.1 confidence across the board — right after the opening
 * semantic answer, before any visual questions. Only `color` and `meta`
 * have been touched at all; most groups are entirely absent (A's reveal
 * logic should treat an absent group as "absent", not "0 confidence
 * blurred" — see IMPLEMENTATION.md #5).
 */
import type { BeliefState } from "@/contracts";

export const confidence01: BeliefState = {
  schemaVersion: 1,
  meta: {
    product: "a booking app for dog groomers",
    audience: "small independent grooming businesses and their clients",
    personality: [],
  },
  groups: {
    color: {
      confidence: 0.1,
      tokens: {
        primary: { $value: "#5b7f5e", $type: "color", provenance: ["e02"] },
      },
    },
  },
  rationale: [
    {
      id: "r01",
      claim:
        "guessed a muted green for primary — pets/grooming often lean natural/organic, unconfirmed",
      tokens: ["color.primary"],
      evidence: ["e02"],
    },
  ],
  events: [
    {
      id: "e00",
      ts: "2026-07-03T00:00:00.000Z",
      kind: "session_start",
      payload: {},
    },
    {
      id: "e01",
      ts: "2026-07-03T00:00:05.000Z",
      kind: "message",
      payload: {
        channel: "chat",
        text: "it's a booking app for dog groomers",
      },
    },
    {
      id: "e02",
      ts: "2026-07-03T00:00:07.000Z",
      kind: "update_beliefs",
      payload: { summary: "captured product/audience, low-confidence color guess" },
    },
  ],
};
