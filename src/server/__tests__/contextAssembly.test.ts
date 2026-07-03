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

  it("puts the user's answer and the volatile belief block in the newest user message, with the cache breakpoint on the answer block (not the belief block)", () => {
    const ctx = assembleContext({
      beliefState: confidence04,
      latestUserText: "the user's latest message",
      priorTurns: [],
    });
    const last = ctx.messages[ctx.messages.length - 1];
    expect(last.role).toBe("user");
    const content = last.content as Array<{ type: string; text: string; cache_control?: unknown }>;

    // The user's answer is its own block, carrying the second cache
    // breakpoint (so the append-only conversation prefix caches).
    const answerBlock = content.find((b) => b.text === "the user's latest message");
    expect(answerBlock?.cache_control).toEqual({ type: "ephemeral" });

    // The belief state trails as the LAST block, uncached (it never recurs),
    // and no longer carries the user's message text.
    const beliefBlock = content[content.length - 1];
    expect(beliefBlock.cache_control).toBeUndefined();
    expect(beliefBlock.text).toContain(JSON.stringify(confidence04.meta.product));
    expect(beliefBlock.text).not.toContain("the user's latest message");
  });

  it("replays the kickoff as the first user message and folds acks + the newest answer into the last", () => {
    const ctx = assembleContext({
      beliefState: emptyBeliefState,
      latestUserText: "next turn",
      priorTurns: [
        {
          // priorTurns[0] is always the kickoff turn; empty userText tells
          // assembly to substitute the kickoff instruction.
          updateBeliefsInput: { meta: {}, tokens: [], confidence: [], rationale: [] },
          interactInput: { mode: "ask", question: "q1?", quickReplies: [] },
          updateBeliefsToolUseId: "tu_1",
          interactToolUseId: "tu_2",
          userText: "",
        },
      ],
    });

    // user(kickoff) + assistant(tool_use pair) + user(acks + newest answer + belief) = 3
    expect(ctx.messages).toHaveLength(3);
    expect(ctx.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);

    // First message replays the kickoff instruction (not a real user answer).
    const kickoffContent = ctx.messages[0].content as Array<{ type: string; text: string }>;
    expect(kickoffContent).toHaveLength(1);
    expect(kickoffContent[0].text).toContain("brand-new session");

    const assistantContent = ctx.messages[1].content as Array<{ type: string; id: string; name: string }>;
    expect(assistantContent.map((b) => b.name)).toEqual(["update_beliefs", "interact"]);
    expect(assistantContent.map((b) => b.id)).toEqual(["tu_1", "tu_2"]);

    const userContent = ctx.messages[2].content as Array<{ type: string; tool_use_id?: string; text?: string }>;
    const resultBlocks = userContent.filter((b) => b.type === "tool_result");
    expect(resultBlocks.map((b) => b.tool_use_id)).toEqual(["tu_1", "tu_2"]);
    const textBlocks = userContent.filter((b) => b.type === "text");
    expect(textBlocks.some((b) => b.text === "next turn")).toBe(true);
  });

  it("replays each prior turn's user answer as its own historical message; roles strictly alternate", () => {
    const ctx = assembleContext({
      beliefState: emptyBeliefState,
      latestUserText: "turn three text",
      priorTurns: [
        {
          updateBeliefsInput: { meta: {}, tokens: [], confidence: [], rationale: [] },
          interactInput: { mode: "ask", question: "q1?", quickReplies: [] },
          updateBeliefsToolUseId: "tu_1",
          interactToolUseId: "tu_2",
          userText: "",
        },
        {
          updateBeliefsInput: { meta: {}, tokens: [], confidence: [], rationale: [] },
          interactInput: { mode: "ask", question: "q2?", quickReplies: [] },
          updateBeliefsToolUseId: "tu_3",
          interactToolUseId: "tu_4",
          userText: "the user answered turn two",
        },
      ],
    });

    // user(kickoff), assistant(t1), user(ack1 + turn2 answer), assistant(t2), user(ack2 + newest) = 5
    expect(ctx.messages).toHaveLength(5);
    const roles = ctx.messages.map((m) => m.role);
    expect(roles).toEqual(["user", "assistant", "user", "assistant", "user"]);
    for (let i = 1; i < roles.length; i++) {
      expect(roles[i]).not.toBe(roles[i - 1]);
    }

    // The second turn's real answer is replayed as a historical user message
    // (this is the fix that lets the model see the user's own earlier words).
    const midContent = ctx.messages[2].content as Array<{ type: string; text?: string }>;
    expect(midContent.some((b) => b.text === "the user answered turn two")).toBe(true);

    const lastContent = ctx.messages[4].content as Array<{ type: string; tool_use_id?: string; text?: string }>;
    const resultBlocks = lastContent.filter((b) => b.type === "tool_result");
    expect(resultBlocks.map((b) => b.tool_use_id)).toEqual(["tu_3", "tu_4"]);
    expect(lastContent.some((b) => b.text === "turn three text")).toBe(true);
  });

  it("keeps the historical replay of a turn byte-identical to how it was sent when newest (append-only cache prefix)", () => {
    const priorKickoff = {
      updateBeliefsInput: { meta: {}, tokens: [], confidence: [], rationale: [] } as const,
      interactInput: { mode: "ask" as const, question: "q1?", quickReplies: [] },
      updateBeliefsToolUseId: "tu_1",
      interactToolUseId: "tu_2",
      userText: "",
    };

    // Turn 2: the user's answer is the newest message.
    const turn2 = assembleContext({
      beliefState: emptyBeliefState,
      latestUserText: "my answer to q1",
      priorTurns: [priorKickoff],
    });
    // The newest user message drops its trailing belief block + cache_control
    // when replayed as history on turn 3.
    const turn2NewestUser = turn2.messages[2].content as Array<{
      type: string;
      text?: string;
      tool_use_id?: string;
      cache_control?: unknown;
    }>;

    // Turn 3: turn 2 is now historical.
    const turn3 = assembleContext({
      beliefState: emptyBeliefState,
      latestUserText: "my answer to q2",
      priorTurns: [
        priorKickoff,
        { ...priorKickoff, updateBeliefsToolUseId: "tu_3", interactToolUseId: "tu_4", userText: "my answer to q1" },
      ],
    });
    const turn3HistoricalUser = turn3.messages[2].content as Array<{
      type: string;
      text?: string;
      tool_use_id?: string;
      cache_control?: unknown;
    }>;

    // The historical message = the live message minus the trailing belief
    // block (and minus cache_control metadata), so the tokenized prefix bytes
    // are identical and the cache from turn 2 is readable on turn 3.
    const strip = (blocks: typeof turn2NewestUser) =>
      blocks
        .filter((b) => !(b.type === "text" && b.text?.startsWith("## Current belief state")))
        .map((b) => ({ type: b.type, text: b.text, tool_use_id: b.tool_use_id }));

    expect(strip(turn3HistoricalUser)).toEqual(strip(turn2NewestUser));
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
