/**
 * resolveTokens — signature frozen in Phase 0; implementation belongs to
 * Workstream A (V0_PLAN.md Phase 0 checklist). Do not implement real
 * resolution here — throw, clearly marked, so a caller that forgets to
 * swap in A's implementation fails loudly instead of silently rendering
 * wrong values.
 *
 * Naming convention (frozen, non-negotiable per V0_PLAN.md "Studio shell
 * design" rule 1): belief-state-derived CSS custom properties are always
 * `--ds-<group>-<token>` (kebab-cased), e.g. belief token "color.primary"
 * resolves to CSS var `--ds-color-primary`. This is the *only* namespace
 * the preview subtree may read. Shell chrome tokens are the separate
 * `--app-*` namespace defined in globals.css (see src/shell/) — never
 * mixed, never read from the same subtree.
 */
import type { BeliefState } from "./beliefState";
import { parseTokenRef } from "./tokenRef";

/** CSS custom property name, always of the form `--ds-<group>-<token>`. */
export type DsCssVarName = `--ds-${string}`;

export type ResolvedTokens = Record<DsCssVarName, string>;

/** Converts a dotted token ref ("color.primary") to its CSS var name
 * ("--ds-color-primary"). Pure formatting helper — safe for any workstream
 * to use ahead of A's resolver landing. */
export function dsVarName(dottedRef: string): DsCssVarName {
  const { group, token } = parseTokenRef(dottedRef);
  const kebabToken = token.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  return `--ds-${group}-${kebabToken}`;
}

/**
 * resolveTokens(state) -> Record<'--ds-*', value>
 *
 * Workstream A implements this for real: walk `state.groups`, format each
 * token's `$value` per its `$type` (e.g. dimension -> "8px"), and key the
 * result by `dsVarName`. This Phase-0 stub intentionally throws so nothing
 * downstream can ship against silently-wrong placeholder values — A's
 * implementation has the same signature and is a drop-in replacement.
 */
export function resolveTokens(_state: BeliefState): ResolvedTokens {
  throw new Error(
    "resolveTokens: not implemented — Workstream A owns this implementation " +
      "(src/contracts/resolveTokens.ts signature is frozen; replace this body only).",
  );
}
