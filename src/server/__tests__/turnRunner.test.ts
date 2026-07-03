import { describe, expect, it } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { runTurn, KICKOFF_INSTRUCTION } from "../turnRunner";
import { createMockAnthropicClient } from "../testUtils/mockAnthropicClient";
import { buildMockMessage } from "../testUtils/buildMockMessage";
import { toolUseBlock } from "../testUtils/toolUseBlock";
import { TOOL_NAMES, EMPTY_TOKEN_PATCH, type TurnStreamEvent } from "@/contracts";
import { emptyBeliefState } from "@fixtures/beliefStates";
import {
  handWrittenOpeningContent,
  handWrittenOpeningPatch,
  handWrittenOpeningInteraction,
  handWrittenOpeningUsage,
} from "@fixtures/recordedTurns/handWrittenOpeningTurn";

function askContent(question: string) {
  return [
    toolUseBlock({ id: "tu_ub", name: TOOL_NAMES.updateBeliefs, input: { patch: EMPTY_TOKEN_PATCH } }),
    toolUseBlock({ id: "tu_ia", name: TOOL_NAMES.interact, input: { mode: "ask", question, quickReplies: [] } }),
  ];
}

describe("runTurn — success path from a recorded fixture", () => {
  it("applies the patch from the hand-written fixture and emits delta + turn events", async () => {
    const { client } = createMockAnthropicClient([
      {
        kind: "message",
        message: buildMockMessage({ content: handWrittenOpeningContent, usage: handWrittenOpeningUsage }),
        deltaTexts: ["What's the ", "personality ", "you're going for?"],
      },
    ]);

    const events: TurnStreamEvent[] = [];
    const result = await runTurn({
      client,
      beliefState: emptyBeliefState,
      latestUserText: KICKOFF_INSTRUCTION,
      priorTurns: [],
      turnIndex: 1,
      onEvent: (e) => events.push(e),
    });

    expect(result.failed).toBe(false);

    // delta events streamed in order, then exactly one turn event
    const deltas = events.filter((e) => e.type === "delta");
    expect(deltas.map((d) => (d as { text: string }).text)).toEqual([
      "What's the ",
      "personality ",
      "you're going for?",
    ]);
    const turnEvents = events.filter((e) => e.type === "turn");
    expect(turnEvents).toHaveLength(1);

    const turnEvent = turnEvents[0] as Extract<TurnStreamEvent, { type: "turn" }>;
    expect(turnEvent.interaction).toEqual(handWrittenOpeningInteraction);

    // Patch was actually applied via the real applyPatch — color.primary
    // present with correct value and provenance stamped to the new event id.
    const colorGroup = turnEvent.beliefState.groups.color;
    expect(colorGroup?.tokens.primary.$value).toBe(
      handWrittenOpeningPatch.tokens.find((t) => t.token === "primary")?.$value,
    );
    expect(colorGroup?.confidence).toBe(0.15);
    expect(colorGroup?.tokens.primary.provenance).toEqual([expect.stringMatching(/^e\d+$/)]);

    // meta was applied
    expect(turnEvent.beliefState.meta.product).toBe(handWrittenOpeningPatch.meta.product);

    // rationale replaced/appended by id
    expect(turnEvent.beliefState.rationale).toHaveLength(1);
    expect(turnEvent.beliefState.rationale[0].id).toBe("r01");

    // events array grew: session_start + update_beliefs + interact
    expect(turnEvent.beliefState.events).toHaveLength(3);
    expect(turnEvent.beliefState.events.map((e) => e.kind)).toEqual([
      "session_start",
      "update_beliefs",
      "interact",
    ]);

    // usage passed through with cache_read_input_tokens intact
    expect(turnEvent.usage.cacheReadInputTokens).toBe(handWrittenOpeningUsage.cache_read_input_tokens);
    expect(turnEvent.usage.inputTokens).toBe(handWrittenOpeningUsage.input_tokens);

    expect(result.priorTurnRecord).toEqual({
      updateBeliefsInput: handWrittenOpeningPatch,
      interactInput: handWrittenOpeningInteraction,
      updateBeliefsToolUseId: "toolu_fixture_update_beliefs_01",
      interactToolUseId: "toolu_fixture_interact_01",
    });
  });

  it("handles export_design_md as the second tool call and synthesizes a completion interaction", async () => {
    const content = [
      toolUseBlock({ id: "tu_ub", name: TOOL_NAMES.updateBeliefs, input: { patch: EMPTY_TOKEN_PATCH } }),
      toolUseBlock({ id: "tu_ex", name: TOOL_NAMES.exportDesignMd, input: {} }),
    ];
    const { client } = createMockAnthropicClient([
      { kind: "message", message: buildMockMessage({ content }) },
    ]);

    const events: TurnStreamEvent[] = [];
    const result = await runTurn({
      client,
      beliefState: emptyBeliefState,
      latestUserText: "please export",
      priorTurns: [],
      turnIndex: 2,
      onEvent: (e) => events.push(e),
    });

    expect(result.failed).toBe(false);
    const turnEvent = events.find((e) => e.type === "turn") as Extract<TurnStreamEvent, { type: "turn" }>;
    expect(turnEvent.interaction.mode).toBe("ask");
    expect(turnEvent.beliefState.events.at(-1)?.kind).toBe("export_design_md");
    expect(result.priorTurnRecord).toBeUndefined();
  });
});

describe("runTurn — protocol enforcement + retry", () => {
  it("retries once on a protocol violation and succeeds on the corrective retry", async () => {
    const badContent = [
      toolUseBlock({ id: "tu_ub", name: TOOL_NAMES.updateBeliefs, input: { patch: EMPTY_TOKEN_PATCH } }),
      // missing interact/export entirely — violation
    ];
    const goodContent = askContent("corrected question?");

    const { client, calls } = createMockAnthropicClient([
      { kind: "message", message: buildMockMessage({ content: badContent }) },
      { kind: "message", message: buildMockMessage({ content: goodContent }) },
    ]);

    const events: TurnStreamEvent[] = [];
    const result = await runTurn({
      client,
      beliefState: emptyBeliefState,
      latestUserText: "hello",
      priorTurns: [],
      turnIndex: 1,
      onEvent: (e) => events.push(e),
    });

    expect(result.failed).toBe(false);
    expect(calls).toHaveLength(2);
    const turnEvents = events.filter((e) => e.type === "turn");
    expect(turnEvents).toHaveLength(1);
    expect((turnEvents[0] as Extract<TurnStreamEvent, { type: "turn" }>).interaction).toMatchObject({
      question: "corrected question?",
    });
    // No error event should have been emitted despite the first attempt's violation.
    expect(events.some((e) => e.type === "error")).toBe(false);
  });

  it("emits a protocol_violation error after the retry also violates the protocol", async () => {
    const badContent = [
      toolUseBlock({ id: "tu_ub", name: TOOL_NAMES.updateBeliefs, input: { patch: EMPTY_TOKEN_PATCH } }),
    ];

    const { client, calls } = createMockAnthropicClient([
      { kind: "message", message: buildMockMessage({ content: badContent }) },
      { kind: "message", message: buildMockMessage({ content: badContent }) },
    ]);

    const events: TurnStreamEvent[] = [];
    const result = await runTurn({
      client,
      beliefState: emptyBeliefState,
      latestUserText: "hello",
      priorTurns: [],
      turnIndex: 1,
      onEvent: (e) => events.push(e),
    });

    expect(result.failed).toBe(true);
    expect(calls).toHaveLength(2); // exactly one retry, not more
    const errorEvent = events.find((e) => e.type === "error") as Extract<TurnStreamEvent, { type: "error" }>;
    expect(errorEvent).toBeDefined();
    expect(errorEvent.code).toBe("protocol_violation");
    // Original state returned unchanged on failure.
    expect(result.beliefState).toEqual(emptyBeliefState);
  });

  it("does not retry more than once even if both attempts are malformed for different reasons", async () => {
    const bad1 = [
      toolUseBlock({ id: "tu_1", name: TOOL_NAMES.updateBeliefs, input: { patch: EMPTY_TOKEN_PATCH } }),
      toolUseBlock({ id: "tu_2", name: TOOL_NAMES.updateBeliefs, input: { patch: EMPTY_TOKEN_PATCH } }),
    ];
    const bad2 = [toolUseBlock({ id: "tu_3", name: "unknown_tool", input: {} })];
    const { client, calls } = createMockAnthropicClient([
      { kind: "message", message: buildMockMessage({ content: bad1 }) },
      { kind: "message", message: buildMockMessage({ content: bad2 }) },
    ]);

    const events: TurnStreamEvent[] = [];
    const result = await runTurn({
      client,
      beliefState: emptyBeliefState,
      latestUserText: "hello",
      priorTurns: [],
      turnIndex: 1,
      onEvent: (e) => events.push(e),
    });

    expect(calls).toHaveLength(2);
    expect(result.failed).toBe(true);
  });
});

describe("runTurn — API failure handling", () => {
  it("maps a RateLimitError to a rate_limited error event without retrying", async () => {
    const rateLimitError = Object.create(Anthropic.RateLimitError.prototype);
    const { client, calls } = createMockAnthropicClient([{ kind: "error", error: rateLimitError }]);

    const events: TurnStreamEvent[] = [];
    const result = await runTurn({
      client,
      beliefState: emptyBeliefState,
      latestUserText: "hello",
      priorTurns: [],
      turnIndex: 1,
      onEvent: (e) => events.push(e),
    });

    expect(result.failed).toBe(true);
    expect(calls).toHaveLength(1); // API errors are not retried by runTurn
    const errorEvent = events.find((e) => e.type === "error") as Extract<TurnStreamEvent, { type: "error" }>;
    expect(errorEvent.code).toBe("rate_limited");
  });

  it("maps a BadRequestError to a bad_request error event", async () => {
    const badRequestError = Object.create(Anthropic.BadRequestError.prototype);
    const { client } = createMockAnthropicClient([{ kind: "error", error: badRequestError }]);

    const events: TurnStreamEvent[] = [];
    await runTurn({
      client,
      beliefState: emptyBeliefState,
      latestUserText: "hello",
      priorTurns: [],
      turnIndex: 1,
      onEvent: (e) => events.push(e),
    });

    const errorEvent = events.find((e) => e.type === "error") as Extract<TurnStreamEvent, { type: "error" }>;
    expect(errorEvent.code).toBe("bad_request");
  });

  it("maps a plain network failure (APIConnectionError) to network_error", async () => {
    const connError = Object.create(Anthropic.APIConnectionError.prototype);
    const { client } = createMockAnthropicClient([{ kind: "error", error: connError }]);

    const events: TurnStreamEvent[] = [];
    await runTurn({
      client,
      beliefState: emptyBeliefState,
      latestUserText: "hello",
      priorTurns: [],
      turnIndex: 1,
      onEvent: (e) => events.push(e),
    });

    const errorEvent = events.find((e) => e.type === "error") as Extract<TurnStreamEvent, { type: "error" }>;
    expect(errorEvent.code).toBe("network_error");
  });

  it("maps an unrecognized thrown value to unknown", async () => {
    const { client } = createMockAnthropicClient([{ kind: "error", error: "a plain string, not an Error" }]);

    const events: TurnStreamEvent[] = [];
    await runTurn({
      client,
      beliefState: emptyBeliefState,
      latestUserText: "hello",
      priorTurns: [],
      turnIndex: 1,
      onEvent: (e) => events.push(e),
    });

    const errorEvent = events.find((e) => e.type === "error") as Extract<TurnStreamEvent, { type: "error" }>;
    expect(errorEvent.code).toBe("unknown");
  });
});

describe("runTurn — request shape sent to the client", () => {
  it("calls the client with the correct model, max_tokens, thinking, and output_config; never sends temperature/top_p/top_k/budget_tokens", async () => {
    const { client, calls } = createMockAnthropicClient([
      { kind: "message", message: buildMockMessage({ content: askContent("q?") }) },
    ]);

    await runTurn({
      client,
      beliefState: emptyBeliefState,
      latestUserText: "hello",
      priorTurns: [],
      turnIndex: 1,
      onEvent: () => {},
    });

    expect(calls).toHaveLength(1);
    const params = calls[0].params as unknown as Record<string, unknown>;
    expect(params.model).toBe("claude-opus-4-8");
    expect(params.max_tokens).toBe(16000);
    expect(params.thinking).toEqual({ type: "adaptive" });
    expect(params.output_config).toEqual({ effort: "high" });
    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("top_p");
    expect(params).not.toHaveProperty("top_k");
    const thinking = params.thinking as Record<string, unknown>;
    expect(thinking).not.toHaveProperty("budget_tokens");
  });

  it("sends tools built deterministically via buildAnthropicTools (3 tools, strict)", async () => {
    const { client, calls } = createMockAnthropicClient([
      { kind: "message", message: buildMockMessage({ content: askContent("q?") }) },
    ]);

    await runTurn({
      client,
      beliefState: emptyBeliefState,
      latestUserText: "hello",
      priorTurns: [],
      turnIndex: 1,
      onEvent: () => {},
    });

    const tools = calls[0].params.tools as Array<{ name: string; strict?: boolean }>;
    expect(tools).toHaveLength(3);
    expect(tools.every((t) => t.strict === true)).toBe(true);
    expect(tools.map((t) => t.name)).toEqual([
      TOOL_NAMES.updateBeliefs,
      TOOL_NAMES.interact,
      TOOL_NAMES.exportDesignMd,
    ]);
  });
});
