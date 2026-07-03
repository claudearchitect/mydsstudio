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
 * Workstream A's implementation: walk `state.groups`, format each token's
 * `$value` per its `$type`, and key the result by `dsVarName`.
 *
 * Formatting rules per `$type` (only the types actually produced by the V0
 * fixtures/agent are given special handling; anything else passes through
 * as a plain string so an unexpected-but-valid token never throws):
 *  - color, dimension, shadow, fontFamily, string: pass the `$value`
 *    through as-is (stringified).
 *  - fontWeight, number: stringified number.
 *  - duration: pass through (already a valid CSS <time>, e.g. "150ms").
 *  - lineHeight: pass through.
 *  - fontSize: V0's shorthand encodes size and weight together as
 *    "<size>/<weight>" (see fixtures, e.g. "20px/600"). Split it into two
 *    CSS vars: the base `--ds-<group>-<token>` carries the size, and a
 *    sibling `--ds-<group>-<token>-weight` carries the weight. Components
 *    that only care about size can ignore the second var.
 *
 * Absent groups (per BeliefState "partial record" — IMPLEMENTATION.md #5)
 * simply contribute no entries; this function never invents defaults.
 */
export function resolveTokens(state: BeliefState): ResolvedTokens {
  const out: Record<string, string> = {};

  for (const groupName of Object.keys(state.groups) as Array<
    keyof BeliefState["groups"]
  >) {
    const group = state.groups[groupName];
    if (!group) continue;

    for (const [tokenName, token] of Object.entries(group.tokens)) {
      const dottedRef = `${String(groupName)}.${tokenName}`;
      const varName = dsVarName(dottedRef);

      if (token.$type === "fontSize") {
        const raw = String(token.$value);
        const slashIdx = raw.indexOf("/");
        if (slashIdx === -1) {
          out[varName] = raw;
        } else {
          const size = raw.slice(0, slashIdx);
          const weight = raw.slice(slashIdx + 1);
          out[varName] = size;
          out[`${varName}-weight`] = weight;
        }
        continue;
      }

      out[varName] = String(token.$value);
    }
  }

  return out as ResolvedTokens;
}
