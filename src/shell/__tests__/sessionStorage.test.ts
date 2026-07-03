import { beforeEach, describe, expect, it } from "vitest";
import type { BeliefState } from "@/contracts";
import { clearSession, restoreSession, saveSession, sessionStorageKeyFor } from "../state/sessionStorage";

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
    saveSession("demo", state, []);
    const restored = restoreSession("demo");
    expect(restored).not.toBeNull();
    expect(restored!.beliefState).toEqual(state);
    expect(restored!.transcript).toEqual([]);
  });

  it("returns null when nothing is saved", () => {
    expect(restoreSession("demo")).toBeNull();
    expect(restoreSession("live")).toBeNull();
  });

  it("discards (does not crash on) a schemaVersion mismatch", () => {
    const badState = { ...baseState(), schemaVersion: 2 } as unknown as BeliefState;
    const payload = {
      envelopeVersion: 1,
      beliefState: badState,
      transcript: [],
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(sessionStorageKeyFor("demo"), JSON.stringify(payload));

    expect(() => restoreSession("demo")).not.toThrow();
    expect(restoreSession("demo")).toBeNull();
  });

  it("discards on malformed JSON without throwing", () => {
    window.localStorage.setItem(sessionStorageKeyFor("demo"), "{not valid json");
    expect(() => restoreSession("demo")).not.toThrow();
    expect(restoreSession("demo")).toBeNull();
  });

  it("discards on an envelope version mismatch", () => {
    const payload = {
      envelopeVersion: 999,
      beliefState: baseState(),
      transcript: [],
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(sessionStorageKeyFor("demo"), JSON.stringify(payload));
    expect(restoreSession("demo")).toBeNull();
  });

  it("discards when beliefState fails schema validation entirely", () => {
    const payload = {
      envelopeVersion: 1,
      beliefState: { totally: "wrong shape" },
      transcript: [],
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(sessionStorageKeyFor("demo"), JSON.stringify(payload));
    expect(() => restoreSession("demo")).not.toThrow();
    expect(restoreSession("demo")).toBeNull();
  });

  it("clearSession removes the stored snapshot", () => {
    saveSession("demo", baseState(), []);
    expect(restoreSession("demo")).not.toBeNull();
    clearSession("demo");
    expect(restoreSession("demo")).toBeNull();
  });

  // Regression coverage for the demo/live race bug: a single shared storage
  // key let one mode's saved transcript get "restored" into the other
  // mode's session on a mode switch (or a fresh mount that re-resolves to a
  // different mode than last time), latching useSession's kickoff guard and
  // leaving the shell stuck showing the wrong turn source's stale history
  // with no way to progress. See sessionStorage.ts's header comment.
  describe("mode isolation", () => {
    it("saves demo and live sessions under distinct keys", () => {
      expect(sessionStorageKeyFor("demo")).not.toBe(sessionStorageKeyFor("live"));
    });

    it("a demo-mode session is never restored by a live-mode lookup", () => {
      const demoState: BeliefState = {
        ...baseState(),
        meta: { product: "demo product", audience: "", personality: [] },
      };
      saveSession("demo", demoState, [
        { kind: "userMessage", id: "msg-1", message: { channel: "chat", text: "hi" }, ts: "2026-01-01T00:00:00.000Z" },
      ]);

      expect(restoreSession("live")).toBeNull();

      const restoredDemo = restoreSession("demo");
      expect(restoredDemo).not.toBeNull();
      expect(restoredDemo!.beliefState.meta.product).toBe("demo product");
    });

    it("saving both modes independently round-trips each without clobbering the other", () => {
      const demoState: BeliefState = {
        ...baseState(),
        meta: { product: "demo product", audience: "", personality: [] },
      };
      const liveState: BeliefState = {
        ...baseState(),
        meta: { product: "live product", audience: "", personality: [] },
      };
      saveSession("demo", demoState, []);
      saveSession("live", liveState, [
        { kind: "userMessage", id: "msg-1", message: { channel: "chat", text: "hi" }, ts: "2026-01-01T00:00:00.000Z" },
      ]);

      expect(restoreSession("demo")!.beliefState.meta.product).toBe("demo product");
      expect(restoreSession("live")!.beliefState.meta.product).toBe("live product");
      expect(restoreSession("demo")!.transcript).toEqual([]);
      expect(restoreSession("live")!.transcript).toHaveLength(1);
    });

    it("clearSession only clears the targeted mode", () => {
      saveSession("demo", baseState(), []);
      saveSession("live", baseState(), []);

      clearSession("demo");

      expect(restoreSession("demo")).toBeNull();
      expect(restoreSession("live")).not.toBeNull();
    });
  });
});
