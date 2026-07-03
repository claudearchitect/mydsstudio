import { describe, expect, it, beforeEach } from "vitest";
import { summarizeEventLog, nextEventId, resetEventIdCounterForTests } from "../eventLog";
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

describe("nextEventId", () => {
  beforeEach(() => resetEventIdCounterForTests());

  it("generates sequential, zero-padded ids with a seed prefix", () => {
    expect(nextEventId("e")).toBe("e01");
    expect(nextEventId("e")).toBe("e02");
    expect(nextEventId("e")).toBe("e03");
  });
});
