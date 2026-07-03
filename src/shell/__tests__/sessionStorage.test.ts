import { beforeEach, describe, expect, it } from "vitest";
import type { BeliefState } from "@/contracts";
import { clearSession, restoreSession, saveSession, SESSION_STORAGE_KEY } from "../state/sessionStorage";

function baseState(): BeliefState {
  return {
    schemaVersion: 1,
    meta: { product: "test product", audience: "", personality: [] },
    groups: {},
    rationale: [],
    events: [],
  };
}

describe("session localStorage snapshot/restore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a saved session", () => {
    const state = baseState();
    saveSession(state, []);
    const restored = restoreSession();
    expect(restored).not.toBeNull();
    expect(restored!.beliefState).toEqual(state);
    expect(restored!.transcript).toEqual([]);
  });

  it("returns null when nothing is saved", () => {
    expect(restoreSession()).toBeNull();
  });

  it("discards (does not crash on) a schemaVersion mismatch", () => {
    const badState = { ...baseState(), schemaVersion: 2 } as unknown as BeliefState;
    const payload = {
      envelopeVersion: 1,
      beliefState: badState,
      transcript: [],
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));

    expect(() => restoreSession()).not.toThrow();
    expect(restoreSession()).toBeNull();
  });

  it("discards on malformed JSON without throwing", () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, "{not valid json");
    expect(() => restoreSession()).not.toThrow();
    expect(restoreSession()).toBeNull();
  });

  it("discards on an envelope version mismatch", () => {
    const payload = {
      envelopeVersion: 999,
      beliefState: baseState(),
      transcript: [],
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    expect(restoreSession()).toBeNull();
  });

  it("discards when beliefState fails schema validation entirely", () => {
    const payload = {
      envelopeVersion: 1,
      beliefState: { totally: "wrong shape" },
      transcript: [],
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    expect(() => restoreSession()).not.toThrow();
    expect(restoreSession()).toBeNull();
  });

  it("clearSession removes the stored snapshot", () => {
    saveSession(baseState(), []);
    expect(restoreSession()).not.toBeNull();
    clearSession();
    expect(restoreSession()).toBeNull();
  });
});
