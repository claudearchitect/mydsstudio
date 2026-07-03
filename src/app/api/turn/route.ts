/**
 * POST /api/turn — Workstream C's route handler (V0_PLAN.md Workstream C:
 * "Route handler POST /api/turn"). Thin wrapper around `runTurn`: parses
 * and validates the request body, streams SSE frames per the frozen turn
 * wire format (`src/contracts/turnWireFormat.ts`), and never lets the
 * `ANTHROPIC_API_KEY` leave this file's server-side execution context.
 *
 * No tool-runner loop here — one call to `runTurn` per request, which
 * itself makes at most two Claude API calls (one corrective retry on a
 * protocol violation; see `turnRunner.ts`).
 */
import { NextRequest } from "next/server";
import { formatSseEvent, type TurnStreamEvent } from "@/contracts";
import { getAnthropicClient, MissingApiKeyError } from "@/server/anthropicClient";
import { runTurn, KICKOFF_INSTRUCTION } from "@/server/turnRunner";
import { TurnRequestSchema, renderNormalizedMessageText } from "@/server/requestSchema";
import { mapErrorToTurnError } from "@/server/errorMapping";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  const encoder = new TextEncoder();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return sseErrorResponse("bad_request", "Request body was not valid JSON.");
  }

  const parsed = TurnRequestSchema.safeParse(body);
  if (!parsed.success) {
    return sseErrorResponse("bad_request", `Request body failed validation: ${parsed.error.message}`);
  }

  const { beliefState, message, priorTurns, turnIndex } = parsed.data;
  const latestUserText = message ? renderNormalizedMessageText(message) : KICKOFF_INSTRUCTION;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: TurnStreamEvent) => {
        controller.enqueue(encoder.encode(formatSseEvent(event)));
      };

      try {
        const client = getAnthropicClient();
        await runTurn({
          client,
          beliefState,
          latestUserText,
          priorTurns,
          turnIndex,
          eventIdSeed: "e",
          onEvent: emit,
        });
      } catch (err) {
        // Reachable only if something throws outside runTurn's own
        // try/catch (e.g. client construction). runTurn itself always
        // emits an `error` SSE event rather than throwing.
        if (err instanceof MissingApiKeyError) {
          emit({ type: "error", code: "server_error", message: err.message });
        } else {
          const mapped = mapErrorToTurnError(err);
          emit({ type: "error", code: mapped.code, message: mapped.message });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/** Used only for request-shape failures that happen before we can even
 * start a turn (bad JSON, schema violation) — still framed as a one-shot
 * SSE stream carrying a single `error` event, so the client's SSE consumer
 * doesn't need a separate non-streaming error path. */
function sseErrorResponse(code: "bad_request", message: string): Response {
  const event: TurnStreamEvent = { type: "error", code, message };
  const body = formatSseEvent(event);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
