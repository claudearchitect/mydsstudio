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

  it("every tool has a non-empty description; every tool but interact is strict", () => {
    // interact runs non-strict — see tools.ts's NON_STRICT_TOOLS doc comment:
    // its flattened union schema (ask | propose, nested up to 4 TokenPatch
    // copies deep for propose's variants) trips Anthropic's strict-mode
    // grammar-complexity limit, discovered via the Phase 2 live-API gate
    // ("The compiled grammar is too large ..."). update_beliefs and
    // export_design_md have no such nesting and stay strict.
    const tools = buildAnthropicTools();
    for (const tool of tools) {
      expect(tool.strict).toBe(tool.name !== TOOL_NAMES.interact);
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
    // Only a *true* object schema (one that declares `properties`) is
    // required to carry additionalProperties:false/required — a
    // discriminated-union root is typed "object" for Anthropic's tool API
    // (which requires a top-level object type) but has no properties of its
    // own; see toJsonSchema.ts's ensureObjectRoot. Each union branch is
    // itself a true object schema and gets walked/asserted on its own.
    if (obj.type === "object" && obj.properties !== undefined) {
      expect(obj.additionalProperties).toBe(false);
      const props = obj.properties as Record<string, unknown>;
      expect(obj.required).toEqual(Object.keys(props));
    }
    for (const v of Object.values(obj)) {
      assertStrictRecursive(v);
    }
  }
}
