/**
 * A mock `AnthropicMessagesClient` for tests and the CLI harness's
 * `--script` mode. No network calls, ever — this is exactly the injection
 * point `anthropicClient.ts` exists to make possible (V0_PLAN.md: "Write
 * your Vitest suite against a mocked Anthropic client / recorded response
 * fixtures — NO test may hit the live API. Structure the client so it's
 * trivially injectable/mockable.").
 *
 * Only implements the surface `turnRunner.ts` actually calls:
 * `client.messages.stream(params).on("text", cb)` +
 * `.finalMessage()` (a Promise<Message>). Not a faithful reimplementation
 * of the SDK's MessageStream — just enough of its shape to drive the code
 * under test.
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { AnthropicMessagesClient } from "../anthropicClient";

/** One scripted response: either a normal Message the mock "returns" from
 * `finalMessage()`, or an error to throw from `.stream()` (simulating an
 * SDK typed exception). */
export type ScriptedResponse =
  | { kind: "message"; message: Anthropic.Message; deltaTexts?: string[] }
  | { kind: "error"; error: unknown };

export interface MockStreamCall {
  params: Anthropic.MessageCreateParamsStreaming;
}

/**
 * Builds a mock client that returns each entry in `script` in order, one
 * per call to `.stream()`. Throws if called more times than the script has
 * entries (surfaces test bugs immediately instead of silently reusing the
 * last response).
 */
export function createMockAnthropicClient(script: ScriptedResponse[]): {
  client: AnthropicMessagesClient;
  calls: MockStreamCall[];
} {
  let cursor = 0;
  const calls: MockStreamCall[] = [];

  const client: AnthropicMessagesClient = {
    messages: {
      stream: ((params: Anthropic.MessageCreateParamsStreaming) => {
        calls.push({ params });
        if (cursor >= script.length) {
          throw new Error(
            `mockAnthropicClient: script exhausted (${script.length} entries) but .stream() was called again`,
          );
        }
        const entry = script[cursor];
        cursor += 1;

        return new FakeMessageStream(entry);
      }) as unknown as AnthropicMessagesClient["messages"]["stream"],
    },
  };

  return { client, calls };
}

/** Minimal event-emitter-shaped fake satisfying the `.on("text", cb)` +
 * `.finalMessage()` surface `turnRunner.ts` uses.
 *
 * Deliberately avoids TS constructor-parameter-property shorthand
 * (`constructor(private x: T)`) — that syntax carries runtime meaning
 * (it's not purely type-level), so Node's `--experimental-strip-types`
 * (used by the CLI harness, see src/server/cli/) cannot strip it and
 * throws ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX. A plain field assignment in
 * the constructor body is fully strippable and behaves identically. */
class FakeMessageStream {
  private entry: ScriptedResponse;
  private textListeners: Array<(delta: string) => void> = [];

  constructor(entry: ScriptedResponse) {
    this.entry = entry;
  }

  on(event: string, listener: (...args: unknown[]) => void): this {
    if (event === "text") {
      this.textListeners.push(listener as (delta: string) => void);
    }
    return this;
  }

  async finalMessage(): Promise<Anthropic.Message> {
    if (this.entry.kind === "error") {
      throw this.entry.error;
    }
    for (const text of this.entry.deltaTexts ?? []) {
      for (const listener of this.textListeners) listener(text);
    }
    return this.entry.message;
  }
}
