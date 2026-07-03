import { describe, expect, it } from "vitest";
import { summarizeEventLog, nextEventIdForState } from "../eventLog";
import type { BeliefEvent } from "@/contracts";

function makeEvents(n: number): BeliefEvent[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `e${i}`,
    ts: new Date(2026, 0, 1, 0, 0, i).toISOString(),
    kind: "message" as const,
    payload: { channel: "chat" as const, text: `msg ${i}` },
  }));
}

describe("summarizeEventLog", () => {
  it("returns the full log verbatim with no summary when under the threshold", () => {
    const events = makeEvents(5);
    const result = summarizeEventLog(events);
    expect(result.verbatim).toEqual(events);
    expect(result.summary).toBeNull();
  });

  it("summarizes older events and keeps a verbatim tail when over the threshold", () => {
    const events = makeEvents(40);
    const result = summarizeEventLog(events);
    expect(result.summary).not.toBeNull();
    expect(result.verbatim.length).toBeLessThan(events.length);
    expect(result.verbatim.at(-1)?.id).toBe("e39");
    expect(result.summary).toMatch(/earlier events summarized/);
  });

  it("summary mentions event kind counts", () => {
    const events: BeliefEvent[] = [
      ...makeEvents(20),
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `u${i}`,
        ts: new Date(2026, 0, 1, 1, 0, i).toISOString(),
        kind: "update_beliefs" as const,
        payload: {},
      })),
    ];
    const result = summarizeEventLog(events);
    expect(result.summary).toMatch(/message/);
  });
});

describe("nextEventIdForState", () => {
  it("derives the next zero-padded id from the max existing suffix", () => {
    const events = (ids: string[]): BeliefEvent[] =>
      ids.map((id) => ({ id, ts: new Date(0).toISOString(), kind: "update_beliefs", payload: {} }));

    expect(nextEventIdForState([], "e")).toBe("e01");
    expect(nextEventIdForState(events(["e00"]), "e")).toBe("e01");
    expect(nextEventIdForState(events(["e00", "e01", "e02"]), "e")).toBe("e03");
  });

  it("is stable across a simulated restart (no process-global counter)", () => {
    // Same input state must always yield the same next id, regardless of how
    // many ids were minted earlier in the process — this is the resumed-
    // session / restart guarantee the module-global counter lacked.
    const state: BeliefEvent[] = [
      { id: "e00", ts: new Date(0).toISOString(), kind: "session_start", payload: {} },
      { id: "e01", ts: new Date(0).toISOString(), kind: "update_beliefs", payload: {} },
    ];
    expect(nextEventIdForState(state, "e")).toBe("e02");
    expect(nextEventIdForState(state, "e")).toBe("e02");
  });

  it("ignores ids that don't match the seed prefix", () => {
    const events: BeliefEvent[] = [
      { id: "u07", ts: new Date(0).toISOString(), kind: "message", payload: {} },
      { id: "e03", ts: new Date(0).toISOString(), kind: "update_beliefs", payload: {} },
    ];
    expect(nextEventIdForState(events, "e")).toBe("e04");
  });
});
