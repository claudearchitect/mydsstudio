/**
 * Anthropic client construction — isolated so the rest of Workstream C can
 * depend on a narrow interface (`AnthropicMessagesClient`) instead of the
 * full SDK client. This is what makes the turn runner trivially mockable in
 * tests (V0_PLAN.md: "Write your Vitest suite against a mocked Anthropic
 * client / recorded response fixtures — NO test may hit the live API").
 *
 * The API key is read server-side only, from `process.env.ANTHROPIC_API_KEY`
 * (AGENTS.md: "the key must never reach the client — only src/server/ reads
 * it"). This module is never imported from a client component.
 */
import Anthropic from "@anthropic-ai/sdk";

/**
 * The one method the turn runner needs from the SDK client. Narrowing to
 * this interface (rather than depending on `Anthropic` directly) is what
 * lets tests inject a fake implementation with no network calls.
 */
export interface AnthropicMessagesClient {
  messages: {
    stream: Anthropic["messages"]["stream"];
  };
}

let cachedClient: Anthropic | null = null;

/**
 * Lazily constructs the real SDK client from `ANTHROPIC_API_KEY`. Lazy so
 * that importing this module (e.g. transitively, via the route handler) at
 * build time never throws just because no key is configured yet — the
 * error only surfaces when a turn is actually attempted, which is the
 * correct behavior while ANTHROPIC_API_KEY is unset in this environment.
 */
export function getAnthropicClient(): AnthropicMessagesClient {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new MissingApiKeyError();
  }

  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

/** Thrown when a turn is attempted with no ANTHROPIC_API_KEY configured.
 * The route handler maps this to a `server_error` SSE event rather than
 * letting it surface as an unhandled 500 with a stack trace. */
export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set. Set it in .env.local (see .env.example) to enable live turns.",
    );
    this.name = "MissingApiKeyError";
  }
}
