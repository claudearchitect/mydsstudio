/**
 * Message normalization — turns raw UI actions from each of the three input
 * channels into a `NormalizedMessage` (src/contracts/message.ts). This is
 * the only place Workstream B constructs these shapes; everything else
 * (chat panel, region overlay, controls) calls into these helpers so the
 * three channels can't drift from the frozen contract.
 *
 * IMPORTANT: this module only *builds* messages. It never writes belief
 * state (single-writer invariant, AGENTS.md) — callers hand the result to
 * the turn dispatcher, which is the only thing that talks to the agent.
 */
import {
  tokensInScopeFor,
  type ChatMessage,
  type ControlMessage,
  type NormalizedMessage,
  type RegionMessage,
} from "@/contracts";

export function normalizeChatMessage(text: string): ChatMessage {
  return { channel: "chat", text: text.trim() };
}

/** Resolves tokens-in-scope for a region comment via the component manifest
 * (IMPLEMENTATION.md #4: "Resolution is deterministic ... component ->
 * token dependencies, so region -> tokens-in-scope is a lookup"). `resolve`
 * looks up the *current* resolved value for a dotted token ref. */
export function normalizeRegionMessage(
  target: string,
  text: string,
  resolve: (dottedRef: string) => string | number | undefined,
): RegionMessage {
  return {
    channel: "region",
    target,
    tokensInScope: tokensInScopeFor(target, resolve),
    text: text.trim(),
  };
}

/** Controls are suggestion composers, not editors (IMPLEMENTATION.md #4):
 * the swatch/stepper never writes belief state directly, it produces a
 * well-formed utterance describing what the user did. `describe` builds
 * that utterance; kept as a parameter so color vs radius controls (and
 * future control types) can phrase themselves differently without this
 * module knowing about UI specifics. */
export function normalizeControlMessage(
  target: string,
  text: string,
): ControlMessage {
  return { channel: "control", target, text };
}

export function describeColorControl(
  dottedRef: string,
  hex: string,
  label?: string,
): string {
  const name = label ?? dottedRef;
  return `user set ${name} to ${hex} via the color swatch picker`;
}

export function describeRadiusControl(
  dottedRef: string,
  px: number,
  label?: string,
): string {
  const name = label ?? dottedRef;
  return `user set ${name} to ${px}px via the radius stepper`;
}

/** Type-narrowing helper for the inspector panel / tests. */
export function isNormalizedMessage(value: unknown): value is NormalizedMessage {
  if (typeof value !== "object" || value === null) return false;
  const channel = (value as { channel?: unknown }).channel;
  return channel === "chat" || channel === "region" || channel === "control";
}
