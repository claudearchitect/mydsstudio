/**
 * Interaction — the shape of the agent's `interact` tool call
 * (IMPLEMENTATION.md #3). Exactly one per turn; the model picks the
 * modality. Consumed by Workstream B (renders the ask/propose UI) and
 * produced by Workstream C (parses it out of the tool_use block).
 */
import { z } from "zod";
import { TokenPatchSchema } from "./tokenPatch";

/** A quick-reply chip for an `ask` interaction. Every ask also always has an
 * implicit free-text + "something else" affordance in the UI (Workstream B
 * responsibility) — chips are a shortcut, never the only path. */
export const QuickReplySchema = z.object({
  id: z.string(),
  label: z.string(),
});
export type QuickReply = z.infer<typeof QuickReplySchema>;

export const AskInteractionSchema = z.object({
  mode: z.literal("ask"),
  question: z.string(),
  quickReplies: z.array(QuickReplySchema),
});
export type AskInteraction = z.infer<typeof AskInteractionSchema>;

/** One visual-pick variant: a patch expressing this option, applied on top
 * of the current belief state (IMPLEMENTATION.md #3 "Proposals are token
 * patches"). `caption` is a short label for the option ("Rounder", "Closer
 * to Stripe"), not the overall proposal caption. */
export const ProposalVariantSchema = z.object({
  id: z.string(),
  caption: z.string(),
  patch: TokenPatchSchema,
});
export type ProposalVariant = z.infer<typeof ProposalVariantSchema>;

export const ProposeInteractionSchema = z.object({
  mode: z.literal("propose"),
  /** dotted token ref(s) this proposal is probing, e.g. "shape.radius" */
  axis: z.array(z.string()),
  /** componentId from the component manifest that variants render against */
  target: z
    .string()
    .describe(
      'The exact componentId the variants render against — MUST be one of: ' +
        '"button.primary", "card.default", "input.text", "heading.default", ' +
        '"badge.default", "nav.default". A single id, never a description or a list.',
    ),
  caption: z.string(),
  variants: z.array(ProposalVariantSchema).min(2).max(4),
});
export type ProposeInteraction = z.infer<typeof ProposeInteractionSchema>;

export const InteractionSchema = z.discriminatedUnion("mode", [
  AskInteractionSchema,
  ProposeInteractionSchema,
]);
export type Interaction = z.infer<typeof InteractionSchema>;
