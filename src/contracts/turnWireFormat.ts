/**
 * Turn wire format — the contract for `POST /api/turn`'s response
 * (V0_PLAN.md Phase 0 checklist, "Turn wire format contract"; shape per
 * IMPLEMENTATION.md #7 streaming/latency-masking notes).
 *
 * The response is a `text/event-stream` (SSE) with exactly three event
 * types:
 *
 *   delta {text}                                   — NL text of `interact`, streamed as it arrives
 *   turn  {beliefState, interaction, usage}         — final payload, sent once, ends the stream
 *   error {code, message}                           — failure at any point, ends the stream
 *
 * Workstream C implements the server (route handler emitting these events);
 * Workstream B consumes the client helper below. Freezing the framing here
 * keeps them independent (V0_PLAN.md).
 *
 * Wire encoding: standard SSE — each event is
 *   event: <type>\n
 *   data: <JSON>\n\n
 * one JSON object per `data:` line (no multi-line data payloads), so a
 * naive line-based parser is sufficient.
 */
import { z } from "zod";
import { BeliefStateSchema } from "./beliefState";
import { InteractionSchema } from "./interaction";
import { TokenPatchSchema } from "./tokenPatch";

export const TurnDeltaEventSchema = z.object({
  type: z.literal("delta"),
  text: z.string(),
});
export type TurnDeltaEvent = z.infer<typeof TurnDeltaEventSchema>;

/** Token usage, surfaced for the prompt-cache hygiene checks in V0_PLAN.md
 * Workstream C ("cache_read_input_tokens > 0 from turn 2 onward"). Field
 * names mirror the Anthropic SDK's `Usage` shape closely enough to pass
 * through with a narrow adapter, without importing the SDK type into the
 * shared contract module. */
export const TurnUsageSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  cacheReadInputTokens: z.number(),
  cacheCreationInputTokens: z.number(),
});
export type TurnUsage = z.infer<typeof TurnUsageSchema>;

export const TurnFinalEventSchema = z.object({
  type: z.literal("turn"),
  beliefState: BeliefStateSchema,
  interaction: InteractionSchema,
  usage: TurnUsageSchema,
  /**
   * The raw `update_beliefs` patch the model emitted this turn (may be
   * empty — "no belief change this turn" is valid, see EMPTY_TOKEN_PATCH).
   * Added in Phase 2 (V0_PLAN.md "Integration + polish": wiring B's real
   * turn agent) once it became clear a stateless-per-request `/api/turn`
   * (no server-side session) requires the *client* to reconstruct each
   * `PriorTurnRecord` for the next request's context replay
   * (src/server/contextAssembly.ts replays the assistant's own prior
   * tool_use content verbatim so the model sees its own history exactly as
   * it produced it). Without the raw patch on the wire, only the merged
   * `beliefState` is available client-side, which cannot be reversed into
   * the exact patch the model called (multiple patches can merge to the
   * same state). Additive field, non-breaking: existing consumers that only
   * read `beliefState`/`interaction`/`usage` are unaffected.
   */
  patch: TokenPatchSchema,
});
export type TurnFinalEvent = z.infer<typeof TurnFinalEventSchema>;

/** Machine-readable error codes (V0_PLAN.md Workstream C: SDK typed-exception
 * chain mapped to these). Extend only via a contract-change commit — B's
 * retry/banner UI switches on this enum. */
export const TurnErrorCodeSchema = z.enum([
  "rate_limited",
  "server_error",
  "bad_request",
  "protocol_violation", // model failed to emit exactly one update_beliefs + one interact, post-retry
  "network_error",
  "unknown",
]);
export type TurnErrorCode = z.infer<typeof TurnErrorCodeSchema>;

export const TurnErrorEventSchema = z.object({
  type: z.literal("error"),
  code: TurnErrorCodeSchema,
  message: z.string(),
});
export type TurnErrorEvent = z.infer<typeof TurnErrorEventSchema>;

export const TurnStreamEventSchema = z.discriminatedUnion("type", [
  TurnDeltaEventSchema,
  TurnFinalEventSchema,
  TurnErrorEventSchema,
]);
export type TurnStreamEvent = z.infer<typeof TurnStreamEventSchema>;

/** Server-side helper: format one event as an SSE wire frame. */
export function formatSseEvent(event: TurnStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * Client helper: consumes a `fetch` Response's ReadableStream body and
 * yields parsed TurnStreamEvents. Framework-agnostic (no React) so both a
 * dev CLI harness (Workstream C) and the chat panel (Workstream B) can use
 * it. Throws on a malformed frame or a payload that fails schema
 * validation — callers should wrap consumption in try/catch and surface
 * failures the same way as an `error` event.
 */
export async function* consumeTurnStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<TurnStreamEvent, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const event = parseSseFrame(frame);
        if (event) yield event;
      }
    }
    // flush any trailing frame without a terminating blank line
    if (buffer.trim().length > 0) {
      const event = parseSseFrame(buffer);
      if (event) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSseFrame(frame: string): TurnStreamEvent | null {
  const lines = frame.split("\n").filter((l) => l.length > 0);
  const dataLine = lines.find((l) => l.startsWith("data:"));
  if (!dataLine) return null;
  const json = dataLine.slice("data:".length).trim();
  const parsed = JSON.parse(json);
  return TurnStreamEventSchema.parse(parsed);
}
