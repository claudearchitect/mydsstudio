import { describe, expect, it } from "vitest";
import { validateTurnToolCalls, buildCorrectiveRetryText } from "../protocolValidation";
import { toolUseBlock } from "../testUtils/toolUseBlock";
import { TOOL_NAMES, EMPTY_TOKEN_PATCH } from "@/contracts";
import {
  handWrittenOpeningContent,
  handWrittenOpeningPatch,
  handWrittenOpeningInteraction,
} from "@fixtures/recordedTurns/handWrittenOpeningTurn";

const ASK_INPUT = { mode: "ask", question: "q?", quickReplies: [] };

describe("validateTurnToolCalls", () => {
  it("accepts the hand-written recorded fixture (update_beliefs + interact)", () => {
    const result = validateTurnToolCalls(handWrittenOpeningContent);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updateBeliefs.patch).toEqual(handWrittenOpeningPatch);
    expect(result.interact?.interaction).toEqual(handWrittenOpeningInteraction);
    expect(result.exportDesignMd).toBeUndefined();
  });

  it("accepts update_beliefs + export_design_md", () => {
    const content = [
      toolUseBlock({ id: "tu_1", name: TOOL_NAMES.updateBeliefs, input: { patch: EMPTY_TOKEN_PATCH } }),
      toolUseBlock({ id: "tu_2", name: TOOL_NAMES.exportDesignMd, input: {} }),
    ];
    const result = validateTurnToolCalls(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.exportDesignMd?.toolUseId).toBe("tu_2");
    expect(result.interact).toBeUndefined();
  });

  it("rejects a turn with only update_beliefs (missing interact/export)", () => {
    const content = [
      toolUseBlock({ id: "tu_1", name: TOOL_NAMES.updateBeliefs, input: { patch: EMPTY_TOKEN_PATCH } }),
    ];
    const result = validateTurnToolCalls(content);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/interact\/export_design_md/);
  });

  it("rejects a turn with only interact (missing update_beliefs)", () => {
    const content = [toolUseBlock({ id: "tu_1", name: TOOL_NAMES.interact, input: ASK_INPUT })];
    const result = validateTurnToolCalls(content);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/update_beliefs/);
  });

  it("rejects a turn with two update_beliefs calls", () => {
    const content = [
      toolUseBlock({ id: "tu_1", name: TOOL_NAMES.updateBeliefs, input: { patch: EMPTY_TOKEN_PATCH } }),
      toolUseBlock({ id: "tu_2", name: TOOL_NAMES.updateBeliefs, input: { patch: EMPTY_TOKEN_PATCH } }),
      toolUseBlock({ id: "tu_3", name: TOOL_NAMES.interact, input: ASK_INPUT }),
    ];
    const result = validateTurnToolCalls(content);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/exactly one update_beliefs/);
  });

  it("rejects a turn with both interact and export_design_md", () => {
    const content = [
      toolUseBlock({ id: "tu_1", name: TOOL_NAMES.updateBeliefs, input: { patch: EMPTY_TOKEN_PATCH } }),
      toolUseBlock({ id: "tu_2", name: TOOL_NAMES.interact, input: ASK_INPUT }),
      toolUseBlock({ id: "tu_3", name: TOOL_NAMES.exportDesignMd, input: {} }),
    ];
    const result = validateTurnToolCalls(content);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/interact\/export_design_md/);
  });

  it("rejects a turn with an unrecognized tool call", () => {
    const content = [
      toolUseBlock({ id: "tu_1", name: TOOL_NAMES.updateBeliefs, input: { patch: EMPTY_TOKEN_PATCH } }),
      toolUseBlock({ id: "tu_2", name: "mystery_tool", input: {} }),
      toolUseBlock({ id: "tu_3", name: TOOL_NAMES.interact, input: ASK_INPUT }),
    ];
    const result = validateTurnToolCalls(content);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/unrecognized tool call/);
    expect(result.reason).toMatch(/mystery_tool/);
  });

  it("rejects malformed update_beliefs input (fails Zod schema)", () => {
    const content = [
      toolUseBlock({
        id: "tu_1",
        name: TOOL_NAMES.updateBeliefs,
        input: { patch: { tokens: "not-an-array" } },
      }),
      toolUseBlock({ id: "tu_2", name: TOOL_NAMES.interact, input: ASK_INPUT }),
    ];
    const result = validateTurnToolCalls(content);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/update_beliefs input failed schema validation/);
  });

  it("rejects malformed interact input (fails Zod schema — bad discriminant)", () => {
    const content = [
      toolUseBlock({ id: "tu_1", name: TOOL_NAMES.updateBeliefs, input: { patch: EMPTY_TOKEN_PATCH } }),
      toolUseBlock({ id: "tu_2", name: TOOL_NAMES.interact, input: { mode: "not-a-real-mode" } }),
    ];
    const result = validateTurnToolCalls(content);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/interact input failed schema validation/);
  });

  it("ignores non-tool_use content blocks (text, thinking) when validating", () => {
    const content = [
      { type: "text" as const, text: "some preamble", citations: null },
      toolUseBlock({ id: "tu_1", name: TOOL_NAMES.updateBeliefs, input: { patch: EMPTY_TOKEN_PATCH } }),
      toolUseBlock({ id: "tu_2", name: TOOL_NAMES.interact, input: ASK_INPUT }),
    ];
    const result = validateTurnToolCalls(content);
    expect(result.ok).toBe(true);
  });
});

describe("buildCorrectiveRetryText", () => {
  it("names the violation and restates the protocol requirement", () => {
    const text = buildCorrectiveRetryText("expected exactly one update_beliefs call, got 0");
    expect(text).toContain("expected exactly one update_beliefs call, got 0");
    expect(text).toContain("update_beliefs");
    expect(text).toContain("interact");
    expect(text).toContain("export_design_md");
  });
});
