/**
 * Tests for RealTurnAgent (Phase 2: wiring B's shell to C's real
 * `/api/turn`). Mocks `global.fetch` to return a hand-built SSE stream
 * (same wire format C's route handler produces, per
 * src/contracts/turnWireFormat.ts) — no network, no live API, per
 * AGENTS.md's "no test may call the live Claude API".
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_TOKEN_PATCH, formatSseEvent, type NormalizedMessage, type TurnStreamEvent } from "@/contracts";
import { emptyBeliefState, confidence01 } from "@fixtures/beliefStates";
import { RealTurnAgent, renderUserText } from "../turn/realTurnAgent";
import { renderNormalizedMessageText } from "@/server/requestSchema";

function sseResponse(events: TurnStreamEvent[]): Response {
  const body = events.map(formatSseEvent).join("");
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

describe("RealTurnAgent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is never exhausted", () => {
    const agent = new RealTurnAgent();
    expect(agent.exhausted).toBe(false);
  });

  it("POSTs to /api/turn and resolves with the settled belief state + interaction", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        { type: "delta", text: "hello " },
        { type: "delta", text: "world" },
        {
          type: "turn",
          beliefState: confidence01,
          interaction: { mode: "ask", question: "q?", quickReplies: [] },
          usage: { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
          patch: EMPTY_TOKEN_PATCH,
          completed: false,
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const agent = new RealTurnAgent();
    const deltas: string[] = [];
    const result = await agent.runTurn(
      { channel: "chat", text: "hi" },
      emptyBeliefState,
      { onDelta: (t) => deltas.push(t) },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/turn",
      expect.objectContaining({ method: "POST" }),
    );
    const [, init] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.beliefState).toEqual(emptyBeliefState);
    expect(sentBody.message).toEqual({ channel: "chat", text: "hi" });
    expect(sentBody.priorTurns).toEqual([]);
    expect(sentBody.turnIndex).toBe(1);

    expect(deltas).toEqual(["hello ", "world"]);
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.beliefState).toEqual(confidence01);
      expect(result.interaction).toEqual({ mode: "ask", question: "q?", quickReplies: [] });
    }
  });

  it("carries forward priorTurns and increments turnIndex across calls", async () => {
    const turnEvent: TurnStreamEvent = {
      type: "turn",
      beliefState: confidence01,
      interaction: { mode: "ask", question: "q?", quickReplies: [] },
      usage: { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 5, cacheCreationInputTokens: 0 },
      patch: EMPTY_TOKEN_PATCH,
      completed: false,
    };
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([turnEvent]));
    vi.stubGlobal("fetch", fetchMock);

    const agent = new RealTurnAgent();
    await agent.runTurn(null, emptyBeliefState);
    await agent.runTurn({ channel: "chat", text: "second" }, confidence01);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(secondCallBody.turnIndex).toBe(2);
    expect(secondCallBody.priorTurns).toHaveLength(1);
    expect(secondCallBody.priorTurns[0].updateBeliefsInput).toEqual(EMPTY_TOKEN_PATCH);
    expect(secondCallBody.priorTurns[0].interactInput).toEqual(turnEvent.interaction);
  });

  it("resolves an error result on an `error` SSE event", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([{ type: "error", code: "rate_limited", message: "slow down" }]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const agent = new RealTurnAgent();
    const result = await agent.runTurn({ channel: "chat", text: "hi" }, emptyBeliefState);

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.code).toBe("rate_limited");
      expect(result.message).toBe("slow down");
    }
  });

  it("resolves a network_error result when fetch itself throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    const agent = new RealTurnAgent();
    const result = await agent.runTurn({ channel: "chat", text: "hi" }, emptyBeliefState);

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.code).toBe("network_error");
    }
  });

  // The client renders each prior turn's user text to store in its
  // PriorTurnRecord (so the server can replay it as that turn's user message).
  // It must render byte-identically to the server's own renderer, or a turn's
  // replayed history diverges from its live text and misses the prompt cache.
  it("messageRenderMatchesServer: renderUserText matches the server's renderNormalizedMessageText on every channel", () => {
    const messages: NormalizedMessage[] = [
      { channel: "chat", text: "a plain answer" },
      {
        channel: "region",
        target: "button.primary",
        text: "make this rounder",
        tokensInScope: ["shape.radius", "color.primary"],
      },
      { channel: "control", text: "radius set to 12px" },
    ];
    for (const message of messages) {
      expect(renderUserText(message)).toBe(renderNormalizedMessageText(message));
    }
    // Kickoff (null) renders empty so the server substitutes the kickoff text.
    expect(renderUserText(null)).toBe("");
  });

  it("carries the rendered userText forward in each prior-turn record", async () => {
    const turnEvent: TurnStreamEvent = {
      type: "turn",
      beliefState: confidence01,
      interaction: { mode: "ask", question: "q?", quickReplies: [] },
      usage: { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 5, cacheCreationInputTokens: 0 },
      patch: EMPTY_TOKEN_PATCH,
      completed: false,
    };
    // Fresh Response per call — a ReadableStream body can only be read once.
    const fetchMock = vi.fn().mockImplementation(() => sseResponse([turnEvent]));
    vi.stubGlobal("fetch", fetchMock);

    const agent = new RealTurnAgent();
    await agent.runTurn(null, emptyBeliefState); // kickoff → userText ""
    await agent.runTurn({ channel: "chat", text: "second" }, confidence01);
    await agent.runTurn({ channel: "chat", text: "third" }, confidence01);

    const thirdBody = JSON.parse(fetchMock.mock.calls[2][1].body as string);
    expect(thirdBody.priorTurns).toHaveLength(2);
    expect(thirdBody.priorTurns[0].userText).toBe(""); // kickoff
    expect(thirdBody.priorTurns[1].userText).toBe("second");
  });

  it("does not record an export turn (avoids replaying a fabricated question)", async () => {
    const askEvent: TurnStreamEvent = {
      type: "turn",
      beliefState: confidence01,
      interaction: { mode: "ask", question: "q?", quickReplies: [] },
      usage: { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
      patch: EMPTY_TOKEN_PATCH,
      completed: false,
    };
    const exportEvent: TurnStreamEvent = {
      ...askEvent,
      interaction: { mode: "ask", question: "Your design.md is ready.", quickReplies: [] },
      completed: true,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(sseResponse([askEvent]))
      .mockResolvedValueOnce(sseResponse([exportEvent]))
      .mockResolvedValueOnce(sseResponse([askEvent]));
    vi.stubGlobal("fetch", fetchMock);

    const agent = new RealTurnAgent();
    await agent.runTurn(null, emptyBeliefState); // turn 1 (ask) → recorded
    await agent.runTurn({ channel: "chat", text: "export please" }, confidence01); // turn 2 (export) → NOT recorded
    await agent.runTurn({ channel: "chat", text: "actually keep going" }, confidence01); // turn 3

    const thirdBody = JSON.parse(fetchMock.mock.calls[2][1].body as string);
    // Only the ask turn is in priorTurns; the export turn is omitted.
    expect(thirdBody.priorTurns).toHaveLength(1);
    expect(thirdBody.priorTurns[0].userText).toBe("");
  });

  it("sends null for message on the kickoff turn", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        {
          type: "turn",
          beliefState: emptyBeliefState,
          interaction: { mode: "ask", question: "kickoff?", quickReplies: [] },
          usage: { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
          patch: EMPTY_TOKEN_PATCH,
          completed: false,
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const agent = new RealTurnAgent();
    await agent.runTurn(null, emptyBeliefState);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.message).toBeNull();
  });
});
