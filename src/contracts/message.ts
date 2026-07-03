/**
 * NormalizedMessage — the one shape all three input channels normalize to
 * before reaching the model (IMPLEMENTATION.md #4). Workstream B produces
 * these; Workstream C consumes them (as event payloads / context assembly).
 */
import { z } from "zod";

export const ChatMessageSchema = z.object({
  channel: z.literal("chat"),
  text: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const RegionMessageSchema = z.object({
  channel: z.literal("region"),
  /** componentId from the component manifest, e.g. "button.primary" */
  target: z.string(),
  /** dotted token ref -> currently resolved value, e.g. "color.primary": "#1d4ed8" */
  tokensInScope: z.record(z.string(), z.union([z.string(), z.number()])),
  text: z.string(),
});
export type RegionMessage = z.infer<typeof RegionMessageSchema>;

export const ControlMessageSchema = z.object({
  channel: z.literal("control"),
  /** dotted token ref this control edits, e.g. "color.primary" */
  target: z.string(),
  /** well-formed utterance describing the user's action, e.g.
   * "user set primary color to #0f766e via the swatch picker" */
  text: z.string(),
});
export type ControlMessage = z.infer<typeof ControlMessageSchema>;

export const NormalizedMessageSchema = z.discriminatedUnion("channel", [
  ChatMessageSchema,
  RegionMessageSchema,
  ControlMessageSchema,
]);
export type NormalizedMessage = z.infer<typeof NormalizedMessageSchema>;
