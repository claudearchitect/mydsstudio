/**
 * Maps a raw error code (from a failed /api/turn call or a null/invalid
 * response) to calm, human-readable copy for the feedback components in
 * this directory. Pure data mapping — no chrome, no `--app-*` tokens here.
 */

export interface FriendlyError {
  title: string;
  description: string;
  canRetry: boolean;
  /** When true, the UI may offer switching to demo mode. */
  suggestDemo?: boolean;
}

export function friendlyError(code: string, message?: string): FriendlyError {
  switch (code.toLowerCase()) {
    case "no_api_key":
    case "missing_key":
      return {
        title: "No API key configured",
        description: "This session has no Anthropic API key set up, so live turns can't run.",
        canRetry: false,
        suggestDemo: true,
      };

    case "network":
    case "timeout":
      return {
        title: "Connection problem",
        description: "The request couldn't reach the server. Check your connection and try again.",
        canRetry: true,
      };

    case "rate_limit":
      return {
        title: "Rate limited",
        description: "Too many requests went out too quickly. Waiting a moment should fix it.",
        canRetry: true,
      };

    case "server":
    case "500":
      return {
        title: "The service had a problem",
        description: "Something went wrong on the server's end. It's usually fine to try again.",
        canRetry: true,
      };

    case "invalid_response":
    case "empty_response":
    case "null_response":
      return {
        title: "The assistant returned nothing usable",
        description: "The response didn't include a usable turn, so nothing changed.",
        canRetry: true,
        suggestDemo: true,
      };

    case "exhausted":
      return {
        title: "The demo script has no more turns",
        description: "This scripted demo has reached its end.",
        canRetry: true,
      };

    default:
      return {
        title: "Something went wrong",
        description: message ?? "An unexpected error occurred.",
        canRetry: true,
      };
  }
}
