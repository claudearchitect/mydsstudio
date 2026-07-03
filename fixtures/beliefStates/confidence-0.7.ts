/**
 * Fixture: ~0.7 confidence — color, shape, and typography are converging;
 * elevation is a fresh low-confidence guess (mid-session).
 */
import type { BeliefState } from "@/contracts";

export const confidence07: BeliefState = {
  schemaVersion: 1,
  meta: {
    product: "a booking app for dog groomers",
    audience: "small independent grooming businesses and their clients",
    personality: ["warm", "trustworthy", "approachable"],
  },
  groups: {
    color: {
      confidence: 0.75,
      tokens: {
        primary: { $value: "#5b7f5e", $type: "color", provenance: ["e06"] },
        onPrimary: { $value: "#ffffff", $type: "color", provenance: ["e06"] },
        surface: { $value: "#faf9f5", $type: "color", provenance: ["e02"] },
        border: { $value: "#e2e0d8", $type: "color", provenance: ["e02"] },
        text: { $value: "#2b2a26", $type: "color", provenance: ["e02"] },
        accent: { $value: "#d98a4f", $type: "color", provenance: ["e10"] },
        onAccent: { $value: "#ffffff", $type: "color", provenance: ["e10"] },
      },
    },
    shape: {
      confidence: 0.7,
      tokens: {
        radius: { $value: "10px", $type: "dimension", provenance: ["e08"] },
        radiusPill: { $value: "9999px", $type: "dimension", provenance: ["e08"] },
      },
    },
    typography: {
      confidence: 0.65,
      tokens: {
        heading: { $value: "20px/600", $type: "fontSize", provenance: ["e12"] },
        body: { $value: "15px/400", $type: "fontSize", provenance: ["e12"] },
        label: { $value: "13px/500", $type: "fontSize", provenance: ["e12"] },
      },
    },
    elevation: {
      confidence: 0.2,
      tokens: {
        card: {
          $value: "0 1px 2px rgba(0,0,0,0.06)",
          $type: "shadow",
          provenance: ["e13"],
        },
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
      claim: "warm terracotta accent for secondary actions, complements the green",
      tokens: ["color.accent"],
      evidence: ["e09", "e10"],
    },
    {
      id: "r04",
      claim: "rounded, friendly sans for headings and body — user rejected a serif option",
      tokens: ["typography.heading", "typography.body"],
      evidence: ["e11", "e12"],
    },
    {
      id: "r05",
      claim: "subtle elevation guessed from 'not too flashy' comment — unconfirmed",
      tokens: ["elevation.card"],
      evidence: ["e13"],
    },
  ],
  events: [
    { id: "e00", ts: "2026-07-03T00:00:00.000Z", kind: "session_start", payload: {} },
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
      payload: { channel: "chat", text: "the green one, feels warm and trustworthy" },
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
      kind: "interact",
      payload: { mode: "propose", axis: ["color.accent"], target: "badge.default" },
    },
    {
      id: "e10",
      ts: "2026-07-03T00:01:10.000Z",
      kind: "message",
      payload: { channel: "chat", text: "the orange badge, it pops nicely against the green" },
    },
    {
      id: "e11",
      ts: "2026-07-03T00:01:12.000Z",
      kind: "interact",
      payload: { mode: "propose", axis: ["typography.heading"], target: "heading.default" },
    },
    {
      id: "e12",
      ts: "2026-07-03T00:01:25.000Z",
      kind: "message",
      payload: { channel: "chat", text: "not the serif, the rounded sans feels friendlier" },
    },
    {
      id: "e13",
      ts: "2026-07-03T00:01:27.000Z",
      kind: "update_beliefs",
      payload: { summary: "low-confidence elevation guess from earlier 'not too flashy' aside" },
    },
  ],
};
