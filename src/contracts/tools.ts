/**
 * Tool input schemas for the three-tool protocol (IMPLEMENTATION.md #3):
 *
 *   update_beliefs(patch, confidence, rationale)   // sole write path, required every turn (may be empty)
 *   interact(mode: "ask" | "propose", ...)         // exactly one per turn
 *   export_design_md()                              // on request or confident completion
 *
 * These Zod schemas are the source of truth. Workstream C derives (or
 * checks) the Anthropic tool-use JSON schemas from these — see
 * `toJsonSchema.ts` for the derivation helper and V0_PLAN.md's requirement
 * that tool schemas be `strict: true`, `additionalProperties: false`, with
 * `required` on every field.
 *
 * Note on `update_beliefs`: the "confidence" and "rationale" arguments named
 * in IMPLEMENTATION.md #3 are folded into the single `patch: TokenPatch`
 * argument here (TokenPatch already carries `confidence` and `rationale`
 * arrays alongside `tokens`/`meta`) — one argument, one schema, no drift
 * between "the patch" and "the confidence/rationale that goes with it".
 */
import { z } from "zod";
import { TokenPatchSchema } from "./tokenPatch";
import { AskInteractionSchema, ProposeInteractionSchema } from "./interaction";

export const UpdateBeliefsInputSchema = z.object({
  patch: TokenPatchSchema,
});
export type UpdateBeliefsInput = z.infer<typeof UpdateBeliefsInputSchema>;

/** interact's input IS the Interaction shape (ask | propose) — no wrapper. */
export const InteractInputSchema = z.discriminatedUnion("mode", [
  AskInteractionSchema,
  ProposeInteractionSchema,
]);
export type InteractInput = z.infer<typeof InteractInputSchema>;

/** No arguments — export is a pure serialization of current state
 * (IMPLEMENTATION.md #6). Zod object (not z.void()) so it still derives a
 * valid `{"type":"object","properties":{},"required":[]}` JSON schema. */
export const ExportDesignMdInputSchema = z.object({});
export type ExportDesignMdInput = z.infer<typeof ExportDesignMdInputSchema>;

export const TOOL_NAMES = {
  updateBeliefs: "update_beliefs",
  interact: "interact",
  exportDesignMd: "export_design_md",
} as const;
