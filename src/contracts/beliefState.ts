/**
 * BeliefState — the single shared artifact (IMPLEMENTATION.md #2).
 *
 * Only the agent (server-side, via `update_beliefs`) writes this document.
 * Everything else (renderer, export, shell) only reads it.
 *
 * Naming convention: token *keys* inside `groups[group].tokens` are the bare
 * name within the group (e.g. "primary" inside group "color"). The dotted
 * form "color.primary" is used everywhere a fully-qualified reference is
 * needed (component manifest, patch ops, rationale.tokens, region-select
 * tokens_in_scope). See `tokenRef.ts` for the join/split helpers.
 */
import { z } from "zod";

/** The V0 latent space (IMPLEMENTATION.md #2, V0_PLAN.md "Out" section pares
 * this to what's actually driven in V0; the schema stays open to the rest so
 * fixtures/rationale can reference them without a contract change). */
export const TokenGroupNameSchema = z.enum([
  "color",
  "typography",
  "spacing",
  "shape",
  "elevation",
  "contrast",
  "motion",
  "voice",
]);
export type TokenGroupName = z.infer<typeof TokenGroupNameSchema>;

/** DTCG-ish `$type` values used by V0 exemplar components. Kept intentionally
 * small; extend only via a contract-change commit. */
export const TokenTypeSchema = z.enum([
  "color",
  "dimension",
  "fontFamily",
  "fontWeight",
  "fontSize",
  "lineHeight",
  "duration",
  "shadow",
  "string",
  "number",
]);
export type TokenType = z.infer<typeof TokenTypeSchema>;

/** A single DTCG-style token. `provenance` is a list of event ids (see
 * BeliefEvent) that most recently justified this value — stamped exclusively
 * by `applyPatch`, never set by hand. */
export const TokenSchema = z.object({
  $value: z.union([z.string(), z.number()]),
  $type: TokenTypeSchema,
  provenance: z.array(z.string()),
});
export type Token = z.infer<typeof TokenSchema>;

/** One parameter group: a confidence scalar (fully model-controlled, see
 * IMPLEMENTATION.md #2) plus its resolved tokens, keyed by bare token name. */
export const TokenGroupSchema = z.object({
  confidence: z.number().min(0).max(1),
  tokens: z.record(z.string(), TokenSchema),
});
export type TokenGroupState = z.infer<typeof TokenGroupSchema>;

/** A living rationale claim (IMPLEMENTATION.md #2: "living claims", not an
 * append-only log — updates *replace* the claim with the same id). */
export const RationaleEntrySchema = z.object({
  id: z.string(),
  claim: z.string(),
  tokens: z.array(z.string()), // dotted refs, e.g. "shape.radius"
  evidence: z.array(z.string()), // event ids
});
export type RationaleEntry = z.infer<typeof RationaleEntrySchema>;

/** Append-only event log. Every user input and every model action is an
 * event; ids are referenced by token provenance and rationale evidence.
 * `payload` is intentionally loose (unknown) at this layer — NormalizedMessage
 * and the tool-input schemas define the shapes that actually get logged. */
export const BeliefEventSchema = z.object({
  id: z.string(),
  ts: z.string(), // ISO 8601
  kind: z.enum([
    "session_start",
    "message", // a NormalizedMessage from the user
    "update_beliefs", // a patch applied by the agent
    "interact", // an ask/propose emitted by the agent
    "export_design_md",
  ]),
  payload: z.unknown(),
});
export type BeliefEvent = z.infer<typeof BeliefEventSchema>;

export const BeliefMetaSchema = z.object({
  product: z.string().default(""),
  audience: z.string().default(""),
  personality: z.array(z.string()).default([]),
});
export type BeliefMeta = z.infer<typeof BeliefMetaSchema>;

export const BeliefStateSchema = z.object({
  /** Schema version for the whole document. Bump on any breaking contract
   * change; consumers (esp. localStorage restore in Workstream B) must
   * discard, not crash on, a mismatched version. */
  schemaVersion: z.literal(1),
  meta: BeliefMetaSchema,
  /** Partial record: only groups the agent has actually touched are
   * present. An untouched group is absent (not present with confidence 0)
   * — see IMPLEMENTATION.md #5 reveal states: "absent" is a distinct state
   * from "blurred". Use `z.partialRecord` (not `z.record`), which does NOT
   * require every enum key to be present. */
  groups: z.partialRecord(TokenGroupNameSchema, TokenGroupSchema),
  rationale: z.array(RationaleEntrySchema),
  events: z.array(BeliefEventSchema),
});
export type BeliefState = z.infer<typeof BeliefStateSchema>;
