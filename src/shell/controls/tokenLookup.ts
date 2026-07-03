/**
 * Reads a token's current resolved value directly off BeliefState.groups —
 * NOT via `resolveTokens` (src/contracts/resolveTokens.ts), which is a
 * Phase-0 stub that intentionally throws until Workstream A implements it.
 * The shell only needs the raw `$value` (a hex string, a "Npx" string,
 * etc.) for controls and region-select tokens-in-scope, not a formatted
 * CSS custom property — so this small helper avoids taking a hard
 * dependency on A's landing before B can function, while staying
 * consistent with the same `state.groups[group].tokens[token].$value`
 * source of truth A's resolver reads from.
 */
import { parseTokenRef, type BeliefState } from "@/contracts";

export function lookupTokenValue(
  state: BeliefState,
  dottedRef: string,
): string | number | undefined {
  try {
    const { group, token } = parseTokenRef(dottedRef);
    return state.groups[group]?.tokens[token]?.$value;
  } catch {
    return undefined;
  }
}

/** Parses a dimension token's `$value` (e.g. "10px") down to its numeric
 * px component, for stepper controls. Returns `fallback` if unparseable. */
export function parsePx(value: string | number | undefined, fallback: number): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const match = value.match(/-?\d+(\.\d+)?/);
    if (match) return parseFloat(match[0]);
  }
  return fallback;
}
