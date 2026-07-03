import { describe, expect, it } from "vitest";
import type { BeliefState } from "@/contracts";
import { withPendingPreview } from "../controls/pendingPreview";

function baseState(): BeliefState {
  return {
    schemaVersion: 1,
    meta: { product: "", audience: "", personality: [] },
    groups: {
      color: {
        confidence: 0.4,
        tokens: { primary: { $value: "#111111", $type: "color", provenance: ["e1"] } },
      },
    },
    rationale: [],
    events: [],
  };
}

describe("withPendingPreview", () => {
  it("overrides a token's displayed value without touching the real state", () => {
    const state = baseState();
    const previewed = withPendingPreview(state, [
      { dottedRef: "color.primary", $value: "#abcdef", $type: "color" },
    ]);

    expect(previewed.groups.color?.tokens.primary?.$value).toBe("#abcdef");
    // Real state object is untouched.
    expect(state.groups.color?.tokens.primary?.$value).toBe("#111111");
  });

  it("is a no-op passthrough (same reference) when there is nothing pending", () => {
    const state = baseState();
    expect(withPendingPreview(state, [])).toBe(state);
  });

  it("creates a new group for a pending token in an untouched group", () => {
    const state = baseState();
    const previewed = withPendingPreview(state, [
      { dottedRef: "shape.radius", $value: "12px", $type: "dimension" },
    ]);
    expect(previewed.groups.shape?.tokens.radius?.$value).toBe("12px");
    expect(state.groups.shape).toBeUndefined();
  });

  it("leaves confidence and provenance untouched by a pending override", () => {
    const state = baseState();
    const previewed = withPendingPreview(state, [
      { dottedRef: "color.primary", $value: "#abcdef", $type: "color" },
    ]);
    expect(previewed.groups.color?.confidence).toBe(0.4);
    expect(previewed.groups.color?.tokens.primary?.provenance).toEqual(["e1"]);
  });
});
