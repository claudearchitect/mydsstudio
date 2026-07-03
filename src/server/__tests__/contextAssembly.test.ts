import { describe, expect, it } from "vitest";
import { assembleContext } from "../contextAssembly";
import { emptyBeliefState, confidence04 } from "@fixtures/beliefStates";

describe("assembleContext", () => {
  it("produces a system prompt that is byte-identical across turns with different belief states", () => {
    const ctx1 = assembleContext({
      beliefState: emptyBeliefState,
      latestUserText: "turn one text",
      priorTurns: [],
    });
    const ctx2 = assembleContext({
      beliefState: confidence04,
      latestUserText: "a completely different turn's text, much longer, with different content entirely",
      priorTurns: [],
    });

    expect(ctx1.system).toEqual(ctx2.system);
  });

  it("produces a system prompt that is byte-identical across three distinct calls", () => {
    const build = () =>
      assembleContext({
        beliefState: emptyBeliefState,
        latestUserText: "text",
        priorTurns: [],
      }).system;

    const a = JSON.stringify(build());
    const b = JSON.stringify(build());
    const c = JSON.stringify(build());
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("system prompt has exactly one block with an ephemeral cache_control breakpoint", () => {
    const ctx = assembleContext({
      beliefState: emptyBeliefState,
      latestUserText: "text",
      priorTurns: [],
    });
    expect(Array.isArray(ctx.system)).toBe(true);
    const system = ctx.system as Array<{ type: string; cache_control?: unknown }>;
    expect(system).toHaveLength(1);
    expect(system[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("system prompt contains zero interpolated values (no ISO timestamps embedded)", () => {
    const ctx = assembleContext({
      beliefState: confidence04,
      latestUserText: "text",
      priorTurns: [],
    });
    const system = ctx.system as Array<{ text: string }>;
    // Confidence-0.4 fixture events carry 2026-07-03 timestamps; assert
    // none of them leaked into the (turn-invariant) system block.
    expect(system[0].text).not.toMatch(/2026-07-03/);
  });

  it("puts the belief state and event tail in the newest user message with a cache_control breakpoint on its last block", () => {
    const ctx = assembleContext({
      beliefState: confidence04,
      latestUserText: "the user's latest message",
      priorTurns: [],
    });
    const last = ctx.messages[ctx.messages.length - 1];
    expect(last.role).toBe("user");
    const content = last.content as Array<{ type: string; text: string; cache_control?: unknown }>;
    const lastBlock = content[content.length - 1];
    expect(lastBlock.cache_control).toEqual({ type: "ephemeral" });
    expect(lastBlock.text).toContain("the user's latest message");
    expect(lastBlock.text).toContain(JSON.stringify(confidence04.meta.product));
  });

  it("replays prior turns as assistant tool_use + user tool_result message pairs", () => {
    const ctx = assembleContext({
      beliefState: emptyBeliefState,
      latestUserText: "next turn",
      priorTurns: [
        {
          updateBeliefsInput: { meta: {}, tokens: [], confidence: [], rationale: [] },
          interactInput: { mode: "ask", question: "q1?", quickReplies: [] },
          updateBeliefsToolUseId: "tu_1",
          interactToolUseId: "tu_2",
        },
      ],
    });

    // 1 assistant + 1 user (tool_result ack) + 1 user (new turn) = 3
    expect(ctx.messages).toHaveLength(3);
    expect(ctx.messages[0].role).toBe("assistant");
    const assistantContent = ctx.messages[0].content as Array<{ type: string; id: string; name: string }>;
    expect(assistantContent.map((b) => b.name)).toEqual(["update_beliefs", "interact"]);
    expect(assistantContent.map((b) => b.id)).toEqual(["tu_1", "tu_2"]);

    expect(ctx.messages[1].role).toBe("user");
    const resultContent = ctx.messages[1].content as Array<{ type: string; tool_use_id: string }>;
    expect(resultContent.map((b) => b.tool_use_id)).toEqual(["tu_1", "tu_2"]);
  });

  it("summarizes the event log tail when the log exceeds the verbatim threshold", () => {
    const events = Array.from({ length: 30 }, (_, i) => ({
      id: `e${i}`,
      ts: new Date(2026, 0, 1, 0, 0, i).toISOString(),
      kind: "message" as const,
      payload: { channel: "chat" as const, text: `msg ${i}` },
    }));
    const stateWithLongLog = { ...emptyBeliefState, events };

    const ctx = assembleContext({
      beliefState: stateWithLongLog,
      latestUserText: "latest",
      priorTurns: [],
    });
    const content = ctx.messages[ctx.messages.length - 1].content as Array<{ text: string }>;
    const text = content[content.length - 1].text;
    expect(text).toContain("earlier events summarized");
    // Only the verbatim tail's events should appear as literal ids in the
    // JSON block, not every one of the 30.
    expect(text).toContain('"e29"');
    expect(text).not.toContain('"e00"');
  });
});
