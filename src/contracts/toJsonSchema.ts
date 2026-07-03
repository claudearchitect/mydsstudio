/**
 * Derives Anthropic tool-use `input_schema` JSON from the Zod tool-input
 * schemas in tools.ts, so the two never drift (V0_PLAN.md: "Tool JSON
 * schemas derived from the Zod definitions (or checked against Zod)").
 *
 * Anthropic's `strict: true` tool mode requires every object schema in the
 * tree to set `additionalProperties: false` and list every one of its own
 * properties in `required` (no optional fields under strict mode — model
 * optionality, if ever needed, is expressed as a nullable/union type, not
 * an absent key). Zod v4's native `z.toJSONSchema` emits `required` for all
 * non-optional keys and omits `additionalProperties` by default, so this
 * helper walks the output and enforces both rules recursively.
 */
import { z } from "zod";
import {
  UpdateBeliefsInputSchema,
  InteractInputSchema,
  ExportDesignMdInputSchema,
  TOOL_NAMES,
} from "./tools";

type JsonSchemaObject = Record<string, unknown>;

function enforceStrict(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(enforceStrict);
  }
  if (node && typeof node === "object") {
    const obj = node as JsonSchemaObject;
    const out: JsonSchemaObject = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = enforceStrict(v);
    }
    if (out.type === "object") {
      out.additionalProperties = false;
      const props = (out.properties as JsonSchemaObject | undefined) ?? {};
      out.required = Object.keys(props);
    }
    return out;
  }
  return node;
}

export function zodToStrictJsonSchema(schema: z.ZodType): JsonSchemaObject {
  const raw = z.toJSONSchema(schema, { target: "draft-7" }) as JsonSchemaObject;
  return enforceStrict(raw) as JsonSchemaObject;
}

/** Anthropic tool definition shape: { name, description, input_schema }.
 * Descriptions are intentionally left for Workstream C to fill in when it
 * writes the system prompt / tool registration — this module only owns
 * schema derivation. */
export interface StrictToolDefinition {
  name: string;
  input_schema: JsonSchemaObject;
}

export function buildToolDefinitions(): StrictToolDefinition[] {
  return [
    {
      name: TOOL_NAMES.updateBeliefs,
      input_schema: zodToStrictJsonSchema(UpdateBeliefsInputSchema),
    },
    {
      name: TOOL_NAMES.interact,
      input_schema: zodToStrictJsonSchema(InteractInputSchema),
    },
    {
      name: TOOL_NAMES.exportDesignMd,
      input_schema: zodToStrictJsonSchema(ExportDesignMdInputSchema),
    },
  ];
}
