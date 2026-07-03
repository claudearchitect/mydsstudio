/**
 * Tests for Workstream A's resolveTokens implementation (body only —
 * signature/dsVarName frozen in src/contracts/resolveTokens.ts). Co-located
 * under src/preview per the workstream's test ownership even though the
 * function under test lives in src/contracts, since A owns the body.
 */
import { describe, expect, it } from "vitest";
import { resolveTokens, dsVarName } from "@/contracts";
import {
  emptyBeliefState,
  confidence01,
  confidence04,
  confidence07,
  confidence095,
} from "@fixtures/beliefStates";

describe("resolveTokens", () => {
  it("returns an empty object for the empty belief state (no groups touched)", () => {
    expect(resolveTokens(emptyBeliefState)).toEqual({});
  });

  it("resolves color and dimension tokens as pass-through values keyed by dsVarName", () => {
    const resolved = resolveTokens(confidence01);
    expect(resolved[dsVarName("color.primary")]).toBe("#5b7f5e");
  });

  it("resolves every token in every touched group at 0.4 confidence", () => {
    const resolved = resolveTokens(confidence04);
    expect(resolved[dsVarName("color.primary")]).toBe("#5b7f5e");
    expect(resolved[dsVarName("color.onPrimary")]).toBe("#ffffff");
    expect(resolved[dsVarName("shape.radius")]).toBe("10px");
    expect(resolved[dsVarName("shape.radiusPill")]).toBe("9999px");
  });

  it("splits fontSize's 'size/weight' shorthand into two CSS vars", () => {
    const resolved = resolveTokens(confidence07);
    expect(resolved[dsVarName("typography.heading")]).toBe("20px");
    expect(resolved["--ds-typography-heading-weight"]).toBe("600");
    expect(resolved[dsVarName("typography.body")]).toBe("15px");
    expect(resolved["--ds-typography-body-weight"]).toBe("400");
  });

  it("resolves shadow tokens as pass-through strings", () => {
    const resolved = resolveTokens(confidence07);
    expect(resolved[dsVarName("elevation.card")]).toBe(
      "0 1px 2px rgba(0,0,0,0.06)",
    );
  });

  it("never emits a key outside the --ds- namespace", () => {
    const resolved = resolveTokens(confidence095);
    for (const key of Object.keys(resolved)) {
      expect(key.startsWith("--ds-")).toBe(true);
    }
  });

  it("resolves every group present in a near-complete fixture", () => {
    const resolved = resolveTokens(confidence095);
    expect(resolved[dsVarName("color.accent")]).toBe("#d98a4f");
    expect(resolved[dsVarName("spacing.inset")]).toBe("16px");
  });

  it("is a pure function: same input produces structurally-equal output", () => {
    expect(resolveTokens(confidence04)).toEqual(resolveTokens(confidence04));
  });

  it("changing a token value in a fixture-like state changes only that var", () => {
    const mutated = {
      ...confidence04,
      groups: {
        ...confidence04.groups,
        color: {
          ...confidence04.groups.color!,
          tokens: {
            ...confidence04.groups.color!.tokens,
            primary: {
              $value: "#000000",
              $type: "color" as const,
              provenance: ["e99"],
            },
          },
        },
      },
    };
    const before = resolveTokens(confidence04);
    const after = resolveTokens(mutated);
    expect(before[dsVarName("color.primary")]).toBe("#5b7f5e");
    expect(after[dsVarName("color.primary")]).toBe("#000000");
    // every other var is untouched
    expect(after[dsVarName("color.onPrimary")]).toBe(
      before[dsVarName("color.onPrimary")],
    );
    expect(after[dsVarName("shape.radius")]).toBe(
      before[dsVarName("shape.radius")],
    );
  });
});
