/**
 * TokenPatch — the sole write shape for the belief state (IMPLEMENTATION.md
 * #1, #3). Produced by the agent's `update_beliefs` tool call, consumed by
 * `applyPatch`. Also reused verbatim to express proposal variants
 * (IMPLEMENTATION.md #3 "Proposals are token patches"): a variant *is* a
 * TokenPatch applied to a scratch copy of the current state.
 */
import { z } from "zod";
import { TokenGroupNameSchema, TokenTypeSchema } from "./beliefState";

/** One token write. `token` is the bare name within `group` (see
 * tokenRef.ts naming convention note). Omitting `$type` is not allowed —
 * every write is fully specified so `applyPatch` never has to guess. */
export const TokenPatchOpSchema = z.object({
  group: TokenGroupNameSchema,
  token: z.string(),
  $value: z.union([z.string(), z.number()]),
  $type: TokenTypeSchema,
});
export type TokenPatchOp = z.infer<typeof TokenPatchOpSchema>;

/** One group-confidence write. Confidence is fully model-controlled
 * (IMPLEMENTATION.md #2) — the client never computes it. */
export const ConfidencePatchOpSchema = z.object({
  group: TokenGroupNameSchema,
  confidence: z.number().min(0).max(1),
});
export type ConfidencePatchOp = z.infer<typeof ConfidencePatchOpSchema>;

/** A rationale claim write. Living claim: if `id` already exists in
 * `state.rationale`, `applyPatch` replaces it in place; otherwise it's
 * appended. Never delete-by-omission — a patch only ever adds/replaces. */
export const RationalePatchOpSchema = z.object({
  id: z.string(),
  claim: z.string(),
  tokens: z.array(z.string()),
  evidence: z.array(z.string()),
});
export type RationalePatchOp = z.infer<typeof RationalePatchOpSchema>;

export const MetaPatchSchema = z
  .object({
    product: z.string().optional(),
    audience: z.string().optional(),
    personality: z.array(z.string()).optional(),
  })
  .strict();
export type MetaPatch = z.infer<typeof MetaPatchSchema>;

/**
 * The full patch shape. Every field is present (possibly empty array) so
 * `applyPatch` and the tool schema never deal with optional-vs-absent
 * ambiguity — required-on-every-field per V0_PLAN.md's strict-schema rule.
 */
export const TokenPatchSchema = z.object({
  meta: MetaPatchSchema,
  tokens: z.array(TokenPatchOpSchema),
  confidence: z.array(ConfidencePatchOpSchema),
  rationale: z.array(RationalePatchOpSchema),
});
export type TokenPatch = z.infer<typeof TokenPatchSchema>;

/** Convenience: an empty patch (valid — "no belief change this turn" per
 * IMPLEMENTATION.md #3, update_beliefs "may be empty"). */
export const EMPTY_TOKEN_PATCH: TokenPatch = {
  meta: {},
  tokens: [],
  confidence: [],
  rationale: [],
};
