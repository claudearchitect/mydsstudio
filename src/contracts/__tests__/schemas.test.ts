import { describe, expect, it } from "vitest";
import { BeliefStateSchema } from "@/contracts/beliefState";
import { TokenPatchSchema, EMPTY_TOKEN_PATCH } from "@/contracts/tokenPatch";
import { NormalizedMessageSchema } from "@/contracts/message";
import { InteractionSchema } from "@/contracts/interaction";
import {
  UpdateBeliefsInputSchema,
  InteractInputSchema,
  ExportDesignMdInputSchema,
} from "@/contracts/tools";
import { buildToolDefinitions } from "@/contracts/toJsonSchema";
import { TurnStreamEventSchema, formatSseEvent, consumeTurnStream } from "@/contracts/turnWireFormat";
import { emptyBeliefState, confidence01, confidence04, confidence07, confidence095 } from "@fixtures/beliefStates";

describe("BeliefState schema round-trips", () => {
  const fixtures = { emptyBeliefState, confidence01, confidence04, confidence07, confidence095 };

  for (const [name, fixture] of Object.entries(fixtures)) {
    it(`${name} parses and round-trips through JSON`, () => {
      const parsed = BeliefStateSchema.parse(fixture);
      const roundTripped = BeliefStateSchema.parse(JSON.parse(JSON.stringify(parsed)));
      expect(roundTripped).toEqual(parsed);
    });
  }
});

describe("TokenPatch schema", () => {
  it("accepts the empty patch", () => {
    expect(() => TokenPatchSchema.parse(EMPTY_TOKEN_PATCH)).not.toThrow();
  });

  it("round-trips a populated patch through JSON", () => {
    const patch = {
      ...EMPTY_TOKEN_PATCH,
      tokens: [{ group: "color", token: "primary", $value: "#fff", $type: "color" }],
      confidence: [{ group: "color", confidence: 0.5 }],
      rationale: [{ id: "r1", claim: "x", tokens: ["color.primary"], evidence: ["e1"] }],
    };
    const parsed = TokenPatchSchema.parse(patch);
    const roundTripped = TokenPatchSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(roundTripped).toEqual(parsed);
  });

  it("rejects an unknown group", () => {
    const bad = {
      ...EMPTY_TOKEN_PATCH,
      tokens: [{ group: "not-a-group", token: "x", $value: "1", $type: "color" }],
    };
    expect(() => TokenPatchSchema.parse(bad)).toThrow();
  });
});

describe("NormalizedMessage schema", () => {
  it("discriminates chat/region/control and round-trips each", () => {
    const chat = { channel: "chat", text: "hi" };
    const region = {
      channel: "region",
      target: "button.primary",
      tokensInScope: { "color.primary": "#fff" },
      text: "too corporate",
    };
    const control = { channel: "control", target: "color.primary", text: "set to #000" };

    for (const msg of [chat, region, control]) {
      const parsed = NormalizedMessageSchema.parse(msg);
      expect(NormalizedMessageSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
    }
  });
});

describe("Interaction schema", () => {
  it("round-trips an ask interaction", () => {
    const ask = { mode: "ask", question: "What are you building?", quickReplies: [] };
    expect(InteractionSchema.parse(ask)).toEqual(ask);
  });

  it("round-trips a propose interaction with 2-4 variants", () => {
    const propose = {
      mode: "propose",
      axis: ["color.primary"],
      target: "button.primary",
      caption: "Pick one",
      variants: [
        { id: "v1", caption: "A", patch: EMPTY_TOKEN_PATCH },
        { id: "v2", caption: "B", patch: EMPTY_TOKEN_PATCH },
      ],
    };
    expect(InteractionSchema.parse(propose)).toEqual(propose);
  });

  it("rejects a propose interaction with only 1 variant", () => {
    const bad = {
      mode: "propose",
      axis: ["color.primary"],
      target: "button.primary",
      caption: "Pick one",
      variants: [{ id: "v1", caption: "A", patch: EMPTY_TOKEN_PATCH }],
    };
    expect(() => InteractionSchema.parse(bad)).toThrow();
  });
});

describe("Tool input schemas", () => {
  it("update_beliefs input wraps a TokenPatch", () => {
    const input = { patch: EMPTY_TOKEN_PATCH };
    expect(UpdateBeliefsInputSchema.parse(input)).toEqual(input);
  });

  it("interact input is the bare Interaction union", () => {
    const input = { mode: "ask", question: "q", quickReplies: [] };
    expect(InteractInputSchema.parse(input)).toEqual(input);
  });

  it("export_design_md input is an empty object", () => {
    expect(ExportDesignMdInputSchema.parse({})).toEqual({});
  });
});

describe("Strict JSON schema derivation", () => {
  const tools = buildToolDefinitions();

  it("derives exactly the three tools by name", () => {
    expect(tools.map((t) => t.name).sort()).toEqual(
      ["export_design_md", "interact", "update_beliefs"].sort(),
    );
  });

  it("every true object schema node (one that declares properties) sets additionalProperties: false and required == all its properties", () => {
    // A discriminated-union root (interact's InteractInputSchema) is typed
    // "object" for Anthropic's tool API (top-level type is required — see
    // toJsonSchema.ts's ensureObjectRoot) but has no `properties` of its
    // own; it's excluded here by the `properties !== undefined` check, same
    // as toJsonSchema.ts's enforceStrict. Each union branch (ask | propose)
    // IS a true object schema and is still walked/asserted normally.
    function walk(node: unknown) {
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (node && typeof node === "object") {
        const obj = node as Record<string, unknown>;
        if (obj.type === "object" && obj.properties !== undefined) {
          expect(obj.additionalProperties).toBe(false);
          const props = obj.properties as Record<string, unknown>;
          expect(new Set(obj.required as string[])).toEqual(new Set(Object.keys(props)));
        }
        for (const v of Object.values(obj)) walk(v);
      }
    }
    for (const tool of tools) walk(tool.input_schema);
  });

  it("strips minimum/maximum from every number/integer node (Anthropic's tool API rejects them — discovered via the Phase 2 live-API gate: a 400 'For number type, properties maximum, minimum are not supported' on every live turn, from ConfidencePatchOpSchema's z.number().min(0).max(1))", () => {
    function walk(node: unknown) {
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (node && typeof node === "object") {
        const obj = node as Record<string, unknown>;
        if (obj.type === "number" || obj.type === "integer") {
          expect(obj.minimum).toBeUndefined();
          expect(obj.maximum).toBeUndefined();
          expect(obj.exclusiveMinimum).toBeUndefined();
          expect(obj.exclusiveMaximum).toBeUndefined();
        }
        for (const v of Object.values(obj)) walk(v);
      }
    }
    for (const tool of tools) walk(tool.input_schema);

    // Confirms the test actually exercises a number node that *would* have
    // carried minimum/maximum before the fix (a schema with no number nodes
    // at all would make the assertions above vacuously true).
    const updateBeliefsSchema = tools.find((t) => t.name === "update_beliefs")!.input_schema;
    expect(JSON.stringify(updateBeliefsSchema)).toContain('"type":"number"');
  });

  it("every tool's input_schema declares a top-level type of object with no oneOf/anyOf at the root (Anthropic's tool API rejects both a missing root type AND a root-level oneOf/anyOf — discovered via the Phase 2 live-API gate: first a 400 'input_schema.type: Field required', then, after adding a sibling type, a second 400 'input_schema does not support oneOf, allOf, or anyOf at the top level'; interact's InteractInputSchema is a top-level z.discriminatedUnion, flattened by flattenTopLevelUnion in toJsonSchema.ts)", () => {
    for (const tool of tools) {
      expect(tool.input_schema.type).toBe("object");
      expect(tool.input_schema.oneOf).toBeUndefined();
      expect(tool.input_schema.anyOf).toBeUndefined();
    }
    // interact's schema specifically must still express both branches: a
    // `mode` property whose value narrows the shape (this test would be
    // vacuous if the fix had instead dropped propose-only fields entirely
    // rather than flattening them in as nullable).
    const interactSchema = tools.find((t) => t.name === "interact")!.input_schema;
    const props = interactSchema.properties as Record<string, unknown>;
    expect(Object.keys(props).sort()).toEqual(
      ["axis", "caption", "question", "quickReplies", "target", "variants", "mode"].sort(),
    );
  });
});

describe("Turn wire format", () => {
  it("round-trips delta/turn/error events through formatSseEvent + consumeTurnStream", async () => {
    const events = [
      { type: "delta" as const, text: "hello " },
      { type: "delta" as const, text: "world" },
      {
        type: "turn" as const,
        beliefState: emptyBeliefState,
        interaction: { mode: "ask" as const, question: "q", quickReplies: [] },
        usage: {
          inputTokens: 100,
          outputTokens: 20,
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: 100,
        },
        patch: EMPTY_TOKEN_PATCH,
        completed: false,
      },
    ];

    for (const e of events) {
      expect(() => TurnStreamEventSchema.parse(e)).not.toThrow();
    }

    const sse = events.map(formatSseEvent).join("");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse));
        controller.close();
      },
    });

    const received = [];
    for await (const e of consumeTurnStream(stream)) {
      received.push(e);
    }
    expect(received).toEqual(events);
  });

  it("round-trips an error event", async () => {
    const errEvent = { type: "error" as const, code: "rate_limited" as const, message: "slow down" };
    const sse = formatSseEvent(errEvent);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse));
        controller.close();
      },
    });
    const received = [];
    for await (const e of consumeTurnStream(stream)) received.push(e);
    expect(received).toEqual([errEvent]);
  });
});
