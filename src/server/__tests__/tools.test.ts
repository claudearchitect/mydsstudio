import { describe, expect, it } from "vitest";
import { buildAnthropicTools } from "../tools";
import { TOOL_NAMES } from "@/contracts";

describe("buildAnthropicTools", () => {
  it("returns the three tools in a fixed order", () => {
    const tools = buildAnthropicTools();
    expect(tools.map((t) => t.name)).toEqual([
      TOOL_NAMES.updateBeliefs,
      TOOL_NAMES.interact,
      TOOL_NAMES.exportDesignMd,
    ]);
  });

  it("every tool is strict with a non-empty description", () => {
    const tools = buildAnthropicTools();
    for (const tool of tools) {
      expect(tool.strict).toBe(true);
      expect(tool.description && tool.description.length).toBeGreaterThan(10);
    }
  });

  it("input_schema is recursively additionalProperties:false with required listing every key", () => {
    const tools = buildAnthropicTools();
    for (const tool of tools) {
      assertStrictRecursive(tool.input_schema as Record<string, unknown>);
    }
  });

  it("serializes byte-identically across repeated calls (deterministic for prompt caching)", () => {
    const a = JSON.stringify(buildAnthropicTools());
    const b = JSON.stringify(buildAnthropicTools());
    expect(a).toBe(b);
  });
});

function assertStrictRecursive(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(assertStrictRecursive);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (obj.type === "object") {
      expect(obj.additionalProperties).toBe(false);
      const props = (obj.properties as Record<string, unknown>) ?? {};
      expect(obj.required).toEqual(Object.keys(props));
    }
    for (const v of Object.values(obj)) {
      assertStrictRecursive(v);
    }
  }
}
