/**
 * Pending preview — provisional client-side render of a suggested control
 * value (IMPLEMENTATION.md #4 "Edit latency: pending previews"). Throwaway
 * client state, never written to the belief-state schema: rendered
 * immediately so a stepper/swatch drag doesn't feel laggy while the model
 * round-trips, then discarded the moment the next real belief state
 * arrives (whether or not it agrees with the suggestion).
 */
import type { BeliefState, TokenType } from "@/contracts";

export interface PendingPreviewEntry {
  dottedRef: string;
  $value: string | number;
  $type: TokenType;
}

/** Applies a set of pending (unconfirmed) token overrides on top of a real
 * belief state, purely for rendering — never persisted, never fed back
 * into applyPatch. Overrides win over the state's real token value but the
 * group's confidence/provenance are untouched. */
export function withPendingPreview(
  state: BeliefState,
  pending: PendingPreviewEntry[],
): BeliefState {
  if (pending.length === 0) return state;
  const groups: BeliefState["groups"] = { ...state.groups };
  for (const entry of pending) {
    const dot = entry.dottedRef.indexOf(".");
    if (dot === -1) continue;
    const group = entry.dottedRef.slice(0, dot) as keyof BeliefState["groups"];
    const token = entry.dottedRef.slice(dot + 1);
    const existingGroup = groups[group] ?? { confidence: 0, tokens: {} };
    groups[group] = {
      confidence: existingGroup.confidence,
      tokens: {
        ...existingGroup.tokens,
        [token]: {
          $value: entry.$value,
          $type: entry.$type,
          provenance: existingGroup.tokens[token]?.provenance ?? [],
        },
      },
    };
  }
  return { ...state, groups };
}
