/**
 * applyPatch — the sole mutation path for BeliefState (IMPLEMENTATION.md
 * #1). Implemented in full here in Phase 0; Workstreams A, B, C, D all
 * consume it as-is. Do not fork or reimplement.
 *
 * Contract:
 *  - Pure: no I/O, no Date.now() side effects beyond what's passed in.
 *  - Immutable: never mutates `state` or `patch`; always returns a new
 *    BeliefState (structural sharing is fine, in-place writes are not).
 *  - Provenance stamping: every TokenPatchOp applied writes
 *    `provenance: [eventId]` on the resulting token, replacing (not
 *    appending to) prior provenance — provenance names the event that most
 *    recently justified the *current* value, not a full history. Full
 *    history lives in `state.events` (see beliefState.ts).
 *  - Rationale is a living-claims list keyed by id: an op whose `id` matches
 *    an existing entry replaces it in place (same position); a new `id` is
 *    appended. (IMPLEMENTATION.md #2 "Rationale".)
 *  - Confidence ops overwrite `groups[group].confidence` outright — no
 *    averaging/blending. The model owns the number.
 *  - Token ops create the group entry if the group has never been touched,
 *    defaulting its confidence to 0 until a confidence op sets it.
 *  - Unknown groups/tokens referenced by a patch that don't validate against
 *    the Zod schemas should be rejected by the caller (via
 *    TokenPatchSchema.parse) before reaching this function; applyPatch
 *    itself does not re-validate shapes, only applies them.
 */
import type { BeliefState } from "./beliefState";
import type { TokenPatch } from "./tokenPatch";

export function applyPatch(
  state: BeliefState,
  patch: TokenPatch,
  eventId: string,
): BeliefState {
  // --- meta ---
  const meta = {
    ...state.meta,
    ...(patch.meta.product !== undefined ? { product: patch.meta.product } : {}),
    ...(patch.meta.audience !== undefined ? { audience: patch.meta.audience } : {}),
    ...(patch.meta.personality !== undefined
      ? { personality: [...patch.meta.personality] }
      : {}),
  };

  // --- groups (tokens + confidence) ---
  const groups: BeliefState["groups"] = { ...state.groups };

  for (const op of patch.tokens) {
    const existingGroup = groups[op.group] ?? { confidence: 0, tokens: {} };
    groups[op.group] = {
      confidence: existingGroup.confidence,
      tokens: {
        ...existingGroup.tokens,
        [op.token]: {
          $value: op.$value,
          $type: op.$type,
          provenance: [eventId],
        },
      },
    };
  }

  for (const op of patch.confidence) {
    const existingGroup = groups[op.group] ?? { confidence: 0, tokens: {} };
    groups[op.group] = {
      ...existingGroup,
      confidence: op.confidence,
    };
  }

  // --- rationale: living claims, replace-by-id or append ---
  let rationale = state.rationale;
  if (patch.rationale.length > 0) {
    rationale = [...state.rationale];
    for (const op of patch.rationale) {
      const idx = rationale.findIndex((r) => r.id === op.id);
      const entry = {
        id: op.id,
        claim: op.claim,
        tokens: [...op.tokens],
        evidence: [...op.evidence],
      };
      if (idx === -1) {
        rationale.push(entry);
      } else {
        rationale[idx] = entry;
      }
    }
  }

  return {
    schemaVersion: state.schemaVersion,
    meta,
    groups,
    rationale,
    events: state.events, // event append is the caller's responsibility (it
    // owns eventId generation and logs the raw patch/message before or
    // alongside calling applyPatch — see BeliefEventSchema).
  };
}
