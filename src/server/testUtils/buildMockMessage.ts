/**
 * Builds a well-formed `Anthropic.Message` from just the fields tests care
 * about, filling in schema-required boilerplate (id, model, role, type)
 * with fixed test values. Keeps test fixtures short and focused on the
 * `content`/`usage`/`stop_reason` that actually vary per test case.
 */
import type Anthropic from "@anthropic-ai/sdk";

export function buildMockMessage(params: {
  content: Anthropic.ContentBlock[];
  usage?: Partial<Anthropic.Usage>;
  stopReason?: Anthropic.Message["stop_reason"];
}): Anthropic.Message {
  return {
    id: "msg_test_fixture",
    container: null,
    content: params.content,
    model: "claude-opus-4-8",
    role: "assistant",
    stop_reason: params.stopReason ?? "tool_use",
    stop_details: null,
    stop_sequence: null,
    type: "message",
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 0,
      cache_creation: null,
      cache_read_input_tokens: 0,
      inference_geo: null,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: "standard",
      ...params.usage,
    },
  };
}
