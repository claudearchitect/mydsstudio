import { describe, expect, it } from "vitest";
import { confidence04, emptyBeliefState } from "@fixtures/beliefStates";
import { deriveTranscript } from "@/export/deriveTranscript";

describe("deriveTranscript", () => {
  it("extracts chat messages as user lines, in event order", () => {
    const transcript = deriveTranscript(confidence04);
    const userLines = transcript.filter((t) => t.speaker === "user").map((t) => t.text);
    expect(userLines).toEqual([
      "it's a booking app for dog groomers",
      "small independent grooming businesses, and pet owners booking with them",
      "the green one, feels warm and trustworthy",
      "the rounder one — friendly, not corporate",
    ]);
  });

  it("extracts ask questions and propose captions as agent lines", () => {
    const transcript = deriveTranscript(confidence04);
    const agentLines = transcript.filter((t) => t.speaker === "agent").map((t) => t.text);
    expect(agentLines).toContain("Who is this mainly for?");
  });

  it("returns an empty transcript for a session with no message/interact events", () => {
    expect(deriveTranscript(emptyBeliefState)).toEqual([]);
  });

  it("never throws on malformed/loose event payloads", () => {
    const weird = {
      ...emptyBeliefState,
      events: [
        { id: "e1", ts: "2026-01-01T00:00:00Z", kind: "message" as const, payload: null },
        { id: "e2", ts: "2026-01-01T00:00:01Z", kind: "message" as const, payload: {} },
        {
          id: "e3",
          ts: "2026-01-01T00:00:02Z",
          kind: "interact" as const,
          payload: { mode: "propose" },
        },
      ],
    };
    expect(() => deriveTranscript(weird)).not.toThrow();
    expect(deriveTranscript(weird)).toEqual([]);
  });
});
