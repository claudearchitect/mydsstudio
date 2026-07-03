import { describe, expect, it } from "vitest";
import { applyPatch } from "@/contracts/applyPatch";
import { EMPTY_TOKEN_PATCH, type TokenPatch } from "@/contracts/tokenPatch";
import type { BeliefState } from "@/contracts/beliefState";

function baseState(): BeliefState {
  return {
    schemaVersion: 1,
    meta: { product: "", audience: "", personality: [] },
    groups: {},
    rationale: [],
    events: [],
  };
}

describe("applyPatch", () => {
  it("is pure: does not mutate the input state or patch", () => {
    const state = baseState();
    const stateSnapshot = JSON.parse(JSON.stringify(state));
    const patch: TokenPatch = {
      ...EMPTY_TOKEN_PATCH,
      tokens: [{ group: "color", token: "primary", $value: "#fff", $type: "color" }],
    };
    const patchSnapshot = JSON.parse(JSON.stringify(patch));

    applyPatch(state, patch, "e1");

    expect(state).toEqual(stateSnapshot);
    expect(patch).toEqual(patchSnapshot);
  });

  it("returns a new object (immutable), not the same reference", () => {
    const state = baseState();
    const result = applyPatch(state, EMPTY_TOKEN_PATCH, "e1");
    expect(result).not.toBe(state);
    expect(result.groups).not.toBe(state.groups);
  });

  it("stamps provenance with the given eventId on new tokens", () => {
    const state = baseState();
    const patch: TokenPatch = {
      ...EMPTY_TOKEN_PATCH,
      tokens: [{ group: "color", token: "primary", $value: "#5b7f5e", $type: "color" }],
    };
    const result = applyPatch(state, patch, "e42");
    expect(result.groups.color?.tokens.primary).toEqual({
      $value: "#5b7f5e",
      $type: "color",
      provenance: ["e42"],
    });
  });

  it("replaces (not appends) provenance when a token is overwritten by a later patch", () => {
    let state = baseState();
    state = applyPatch(
      state,
      { ...EMPTY_TOKEN_PATCH, tokens: [{ group: "color", token: "primary", $value: "#111", $type: "color" }] },
      "e1",
    );
    state = applyPatch(
      state,
      { ...EMPTY_TOKEN_PATCH, tokens: [{ group: "color", token: "primary", $value: "#222", $type: "color" }] },
      "e2",
    );
    expect(state.groups.color?.tokens.primary).toEqual({
      $value: "#222",
      $type: "color",
      provenance: ["e2"],
    });
  });

  it("creates a group with confidence 0 when a token op targets an untouched group", () => {
    const state = baseState();
    const result = applyPatch(
      state,
      { ...EMPTY_TOKEN_PATCH, tokens: [{ group: "shape", token: "radius", $value: "8px", $type: "dimension" }] },
      "e1",
    );
    expect(result.groups.shape?.confidence).toBe(0);
    expect(result.groups.shape?.tokens.radius?.$value).toBe("8px");
  });

  it("confidence ops overwrite outright, no blending", () => {
    let state = baseState();
    state = applyPatch(state, { ...EMPTY_TOKEN_PATCH, confidence: [{ group: "color", confidence: 0.2 }] }, "e1");
    state = applyPatch(state, { ...EMPTY_TOKEN_PATCH, confidence: [{ group: "color", confidence: 0.9 }] }, "e2");
    expect(state.groups.color?.confidence).toBe(0.9);
  });

  it("rationale: appends a new id, replaces an existing id in place", () => {
    let state = baseState();
    state = applyPatch(
      state,
      {
        ...EMPTY_TOKEN_PATCH,
        rationale: [{ id: "r1", claim: "first claim", tokens: ["color.primary"], evidence: ["e1"] }],
      },
      "e1",
    );
    state = applyPatch(
      state,
      {
        ...EMPTY_TOKEN_PATCH,
        rationale: [{ id: "r2", claim: "second claim", tokens: ["shape.radius"], evidence: ["e2"] }],
      },
      "e2",
    );
    expect(state.rationale.map((r) => r.id)).toEqual(["r1", "r2"]);

    state = applyPatch(
      state,
      {
        ...EMPTY_TOKEN_PATCH,
        rationale: [{ id: "r1", claim: "updated first claim", tokens: ["color.primary"], evidence: ["e1", "e3"] }],
      },
      "e3",
    );
    expect(state.rationale).toHaveLength(2);
    expect(state.rationale[0]).toEqual({
      id: "r1",
      claim: "updated first claim",
      tokens: ["color.primary"],
      evidence: ["e1", "e3"],
    });
  });

  it("meta fields patch independently and leave untouched fields alone", () => {
    const state = baseState();
    const result = applyPatch(state, { ...EMPTY_TOKEN_PATCH, meta: { product: "a booking app" } }, "e1");
    expect(result.meta).toEqual({ product: "a booking app", audience: "", personality: [] });
  });

  it("an empty patch is a no-op on groups/rationale but still returns a new object", () => {
    const state = baseState();
    const result = applyPatch(state, EMPTY_TOKEN_PATCH, "e1");
    expect(result.groups).toEqual({});
    expect(result.rationale).toEqual([]);
    expect(result).not.toBe(state);
  });
});
