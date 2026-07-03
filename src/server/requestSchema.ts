/**
 * Request body schema for `POST /api/turn`. This is Workstream C's own
 * concern (not a frozen contract) — it's the shape the route handler
 * expects from whatever client calls it (Workstream B's shell, or the CLI
 * harness). Kept as a small Zod schema so the route handler can reject a
 * malformed request with a clean `bad_request` error instead of throwing.
 *
 * Design: the caller is responsible for holding session state (belief
 * state + prior turn records) between calls — this route is stateless
 * per V0_PLAN's "session state in memory + localStorage; no database"
 * (IMPLEMENTATION.md #7). Each request carries the full current state back
 * in, the same way each response carries the full next state back out.
 */
import { z } from "zod";
import { BeliefStateSchema, NormalizedMessageSchema, TokenPatchSchema, InteractionSchema } from "@/contracts";

const PriorTurnRecordSchema = z.object({
  updateBeliefsInput: TokenPatchSchema,
  interactInput: InteractionSchema,
  updateBeliefsToolUseId: z.string(),
  interactToolUseId: z.string(),
});

export const TurnRequestSchema = z.object({
  beliefState: BeliefStateSchema,
  /** Omitted (or null) for the kickoff turn of a brand-new session. */
  message: NormalizedMessageSchema.nullish(),
  priorTurns: z.array(PriorTurnRecordSchema).default([]),
  turnIndex: z.number().int().min(1).default(1),
});
export type TurnRequest = z.infer<typeof TurnRequestSchema>;

/** Renders a NormalizedMessage into the plain-text "latest input" the
 * system prompt / context assembly expects. Each channel gets a short
 * prefix so the model can distinguish chat replies from region comments
 * and control tweaks without a separate schema for turn payload text. */
export function renderNormalizedMessageText(
  message: z.infer<typeof NormalizedMessageSchema>,
): string {
  switch (message.channel) {
    case "chat":
      return message.text;
    case "region":
      return [
        `[region comment on ${message.target}]`,
        `tokens in scope: ${JSON.stringify(message.tokensInScope)}`,
        message.text,
      ].join("\n");
    case "control":
      return `[control] ${message.text}`;
  }
}
