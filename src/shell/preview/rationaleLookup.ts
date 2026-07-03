/**
 * Resolves the rationale claims relevant to a given component (V0_PLAN.md
 * Phase 2, "A + C: tap/hover a preview component -> rationale claims for
 * its token groups"). A claim is relevant to a component if it names at
 * least one token the component's manifest entry depends on
 * (`rationale[].tokens` intersects `manifest[componentId].tokenGroups`) —
 * the same deterministic manifest lookup region-select already uses for
 * `tokensInScopeFor`, just checked against the rationale list instead of
 * resolved values.
 */
import { getManifestEntry, type BeliefState } from "@/contracts";

export function rationaleClaimsFor(state: BeliefState, componentId: string): string[] {
  const entry = getManifestEntry(componentId);
  if (!entry) return [];
  const deps = new Set(entry.tokenGroups);
  return state.rationale
    .filter((r) => r.tokens.some((t) => deps.has(t)))
    .map((r) => r.claim);
}
