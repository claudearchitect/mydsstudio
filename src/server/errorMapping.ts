/**
 * API failure handling (V0_PLAN.md Workstream C: "SDK typed-exception chain
 * (rate limit vs server error vs bad request) mapped to error event codes;
 * the client decides retry UX").
 *
 * Follows the claude-api skill's documented exception chain: catch from
 * most-specific to least-specific (RateLimitError -> BadRequestError ->
 * APIConnectionError -> APIStatusError/APIError -> unknown), never by
 * string-matching `error.message`.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { TurnErrorCode } from "@/contracts";
import { MissingApiKeyError } from "./anthropicClient";

export interface MappedTurnError {
  code: TurnErrorCode;
  message: string;
}

/**
 * Maps any error thrown by the Anthropic SDK (or by our own client
 * construction) to a wire-format `TurnErrorCode` + a safe-to-display
 * message. Order matters: most specific exception classes are checked
 * first, since several subclass a common base.
 */
export function mapErrorToTurnError(err: unknown): MappedTurnError {
  if (err instanceof MissingApiKeyError) {
    return { code: "server_error", message: err.message };
  }

  if (err instanceof Anthropic.RateLimitError) {
    return {
      code: "rate_limited",
      message: "The Claude API rate-limited this request. Please wait and retry.",
    };
  }

  if (err instanceof Anthropic.BadRequestError) {
    return {
      code: "bad_request",
      message: `The request was malformed: ${err.message}`,
    };
  }

  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return {
      code: "server_error",
      message: "The server's Claude API credentials are invalid or lack permission.",
    };
  }

  if (err instanceof Anthropic.APIConnectionError) {
    return {
      code: "network_error",
      message: "Could not reach the Claude API — network error.",
    };
  }

  if (err instanceof Anthropic.InternalServerError) {
    return {
      code: "server_error",
      message: "The Claude API returned a server error.",
    };
  }

  // Any other non-2xx HTTP response the typed subclasses above didn't
  // catch (e.g. 404, 409, 422, 529 overloaded).
  if (err instanceof Anthropic.APIError) {
    return {
      code: "server_error",
      message: `The Claude API returned an error: ${err.message}`,
    };
  }

  if (err instanceof Error) {
    return { code: "unknown", message: err.message };
  }

  return { code: "unknown", message: "An unknown error occurred." };
}
