/**
 * Reveal-state derivation (IMPLEMENTATION.md #5, V0_PLAN.md Workstream A).
 *
 * Per component: look at the confidence of every belief-state group its
 * manifest dependencies touch, combine them, and bucket the result into
 * one of three reveal states:
 *
 *   - "absent"  — at least one dependency's group has never been touched
 *                 (the group key is absent from `state.groups` — see
 *                 BeliefState "partial record" note in beliefState.ts).
 *                 This is a distinct state from "blurred": an untouched
 *                 group is not the same as a present group at confidence 0.
 *   - "blurred" — every dependency's group is present, but the combined
 *                 confidence is below the sharp threshold.
 *   - "sharp"   — combined confidence at/above the sharp threshold.
 *
 * All thresholds/knobs live in REVEAL_CONFIG below — nothing is a magic
 * number scattered through the renderer.
 */
import type { BeliefState, TokenGroupName } from "@/contracts";
import { getManifestEntry } from "@/contracts";
import { parseTokenRef } from "@/contracts";

export type RevealState = "absent" | "blurred" | "sharp";

export interface RevealConfig {
  /** Combined confidence at/above this is "sharp" (fully revealed). */
  sharpThreshold: number;
  /** Combined confidence below this (but with all deps present) rounds
   * down to fully "absent" rather than a barely-visible blur — keeps the
   * lowest end of the range from rendering a near-illegible smear. */
  absentFloor: number;
  /** How per-dependency group confidences combine into one component-level
   * number. "min" is conservative (a component is only as confident as its
   * least-confident dependency); "weighted" would need per-dependency
   * weights, which V0's manifest doesn't declare, so "min" is what's
   * actually implemented. Kept as a named strategy so the combine function
   * documents itself and a future weighted mode is a config change, not a
   * rewrite. */
  combine: "min";
  /** Blur filter range in pixels: 0 at sharpThreshold, maxBlurPx at
   * confidence 0 (or at absentFloor, since below-floor renders as "absent"
   * and isn't blurred at all). */
  maxBlurPx: number;
  /** Opacity applied alongside blur so "blurred" reads as provisional even
   * before the filter is visually obvious at low blur amounts. */
  minOpacity: number;
}

export const REVEAL_CONFIG: RevealConfig = {
  sharpThreshold: 0.85,
  absentFloor: 0.05,
  combine: "min",
  maxBlurPx: 10,
  minOpacity: 0.55,
};

/** Resolves the distinct set of belief-state groups a component's manifest
 * dependencies touch (from the manifest alone — whether those groups are
 * actually present in a given state is checked separately by
 * combinedConfidence, since "absent" is a per-state read). */
function dependencyGroups(componentId: string): TokenGroupName[] | undefined {
  const entry = getManifestEntry(componentId);
  if (!entry || entry.tokenGroups.length === 0) return [];

  const groups: TokenGroupName[] = [];
  for (const ref of entry.tokenGroups) {
    const { group } = parseTokenRef(ref);
    if (!groups.includes(group)) groups.push(group);
  }
  return groups;
}

/** Combines the confidences of a set of groups per REVEAL_CONFIG.combine.
 * Returns undefined if any group is absent from state.groups (caller
 * treats that as the "absent" reveal state). */
function combinedConfidence(
  groups: TokenGroupName[],
  state: BeliefState,
  config: RevealConfig,
): number | undefined {
  if (groups.length === 0) return 1; // no dependencies -> always sharp
  const confidences: number[] = [];
  for (const g of groups) {
    const group = state.groups[g];
    if (!group) return undefined; // untouched group -> absent
    confidences.push(group.confidence);
  }
  switch (config.combine) {
    case "min":
      return Math.min(...confidences);
  }
}

/** Derives a component's reveal state from a belief state, per
 * REVEAL_CONFIG. Pure function — no memoization, cheap enough per render
 * for V0's ~6-component library. */
export function deriveRevealState(
  componentId: string,
  state: BeliefState,
  config: RevealConfig = REVEAL_CONFIG,
): RevealState {
  const groups = dependencyGroups(componentId);
  if (groups === undefined) return "absent";

  const confidence = combinedConfidence(groups, state, config);
  if (confidence === undefined) return "absent";
  if (confidence < config.absentFloor) return "absent";
  if (confidence >= config.sharpThreshold) return "sharp";
  return "blurred";
}

/** Maps a combined confidence to the CSS blur amount (px) for the
 * "blurred" reveal state. Confidence at/above sharpThreshold -> 0 (caller
 * won't be in "blurred" state at that point anyway); confidence at
 * absentFloor -> maxBlurPx; interpolated linearly between. */
export function blurPxForConfidence(
  confidence: number,
  config: RevealConfig = REVEAL_CONFIG,
): number {
  const { absentFloor, sharpThreshold, maxBlurPx } = config;
  if (confidence >= sharpThreshold) return 0;
  if (confidence <= absentFloor) return maxBlurPx;
  const t = (confidence - absentFloor) / (sharpThreshold - absentFloor);
  return maxBlurPx * (1 - t);
}

/** Maps a combined confidence to the opacity for the "blurred" reveal
 * state, interpolating between minOpacity (at absentFloor) and 1 (at
 * sharpThreshold). */
export function opacityForConfidence(
  confidence: number,
  config: RevealConfig = REVEAL_CONFIG,
): number {
  const { absentFloor, sharpThreshold, minOpacity } = config;
  if (confidence >= sharpThreshold) return 1;
  if (confidence <= absentFloor) return minOpacity;
  const t = (confidence - absentFloor) / (sharpThreshold - absentFloor);
  return minOpacity + (1 - minOpacity) * t;
}

/** Component-level combined confidence, exposed for the renderer to drive
 * blurPxForConfidence/opacityForConfidence without recomputing the
 * dependency walk. Returns 0 for an "absent" component (irrelevant, since
 * absent components don't render their filter styles). */
export function componentConfidence(
  componentId: string,
  state: BeliefState,
  config: RevealConfig = REVEAL_CONFIG,
): number {
  const groups = dependencyGroups(componentId);
  if (groups === undefined) return 0;
  const confidence = combinedConfidence(groups, state, config);
  return confidence ?? 0;
}
