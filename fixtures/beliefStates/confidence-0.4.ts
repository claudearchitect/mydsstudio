/**
 * Fixture: ~0.4 confidence — a couple of visual picks in, color and shape
 * are taking shape and typography has a fresh low-confidence guess (from an
 * offhand aside, not yet confirmed by a proposal pick); elevation is still
 * unexplored.
 *
 * Deliberately touches three groups (not just two) so every manifest
 * component has all of its dependency groups present but below the sharp
 * threshold (REVEAL_CONFIG.sharpThreshold = 0.85) — otherwise every
 * component would derive "absent" (an untouched dependency group) rather
 * than "blurred", making the gate's "0.4 partially blurred" state
 * unreachable. See src/preview/revealState.ts and V0_PLAN.md Phase 2 item
 * "Fix the carried 0.4-fixture flag".
 */
import type { BeliefState } from "@/contracts";

export const confidence04: BeliefState = {
  schemaVersion: 1,
  meta: {
    product: "a booking app for dog groomers",
    audience: "small independent grooming businesses and their clients",
    personality: ["warm", "trustworthy"],
  },
  groups: {
    color: {
      confidence: 0.45,
      tokens: {
        primary: { $value: "#5b7f5e", $type: "color", provenance: ["e06"] },
        onPrimary: { $value: "#ffffff", $type: "color", provenance: ["e06"] },
        surface: { $value: "#faf9f5", $type: "color", provenance: ["e02"] },
        border: { $value: "#e2e0d8", $type: "color", provenance: ["e02"] },
        text: { $value: "#2b2a26", $type: "color", provenance: ["e02"] },
      },
    },
    shape: {
      confidence: 0.4,
      tokens: {
        radius: { $value: "10px", $type: "dimension", provenance: ["e08"] },
        radiusPill: { $value: "9999px", $type: "dimension", provenance: ["e08"] },
      },
    },
    typography: {
      confidence: 0.3,
      tokens: {
        heading: { $value: "20px/600", $type: "fontSize", provenance: ["e09"] },
        body: { $value: "15px/400", $type: "fontSize", provenance: ["e09"] },
        label: { $value: "13px/500", $type: "fontSize", provenance: ["e09"] },
      },
    },
  },
  rationale: [
    {
      id: "r01",
      claim: "confirmed muted green primary — user picked it over a bolder teal",
      tokens: ["color.primary"],
      evidence: ["e02", "e06"],
    },
    {
      id: "r02",
      claim: "soft-rounded shapes chosen twice, said 'friendly, not corporate'",
      tokens: ["shape.radius", "shape.radiusPill"],
      evidence: ["e07", "e08"],
    },
    {
      id: "r03",
      claim: "guessed a rounded, friendly sans from 'friendly, not corporate' aside — unconfirmed",
      tokens: ["typography.heading", "typography.body", "typography.label"],
      evidence: ["e08", "e09"],
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
      payload: { channel: "chat", text: "it's a booking app for dog groomers" },
    },
    {
      id: "e02",
      ts: "2026-07-03T00:00:07.000Z",
      kind: "update_beliefs",
      payload: { summary: "captured product/audience, low-confidence color guess" },
    },
    {
      id: "e03",
      ts: "2026-07-03T00:00:08.000Z",
      kind: "interact",
      payload: { mode: "ask", question: "Who is this mainly for?" },
    },
    {
      id: "e04",
      ts: "2026-07-03T00:00:20.000Z",
      kind: "message",
      payload: {
        channel: "chat",
        text: "small independent grooming businesses, and pet owners booking with them",
      },
    },
    {
      id: "e05",
      ts: "2026-07-03T00:00:25.000Z",
      kind: "interact",
      payload: { mode: "propose", axis: ["color.primary"], target: "button.primary" },
    },
    {
      id: "e06",
      ts: "2026-07-03T00:00:40.000Z",
      kind: "message",
      payload: {
        channel: "chat",
        text: "the green one, feels warm and trustworthy",
      },
    },
    {
      id: "e07",
      ts: "2026-07-03T00:00:42.000Z",
      kind: "interact",
      payload: { mode: "propose", axis: ["shape.radius"], target: "card.default" },
    },
    {
      id: "e08",
      ts: "2026-07-03T00:00:55.000Z",
      kind: "message",
      payload: { channel: "chat", text: "the rounder one — friendly, not corporate" },
    },
    {
      id: "e09",
      ts: "2026-07-03T00:00:57.000Z",
      kind: "update_beliefs",
      payload: {
        summary: "low-confidence typography guess inferred from 'friendly, not corporate' aside",
      },
    },
  ],
};
