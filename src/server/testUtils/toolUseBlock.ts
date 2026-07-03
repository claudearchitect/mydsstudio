/**
 * Test-only helper for constructing `Anthropic.ToolUseBlock`-shaped content
 * blocks. The SDK's `ToolUseBlock` (response-side, unlike the
 * request-side `ToolUseBlockParam`) requires a `caller` field
 * (`DirectCaller | ServerToolCaller | ...`) identifying how the tool call
 * was made. Every tool_use block a real model turn produces (i.e. not via
 * programmatic tool calling) has `caller: { type: "direct" }` — this
 * helper fills that in so test fixtures don't have to repeat it.
 */
import type Anthropic from "@anthropic-ai/sdk";

export function toolUseBlock(params: {
  id: string;
  name: string;
  input: unknown;
}): Anthropic.ToolUseBlock {
  return {
    type: "tool_use",
    id: params.id,
    name: params.name,
    input: params.input,
    caller: { type: "direct" },
  };
}
