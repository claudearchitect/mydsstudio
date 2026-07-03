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
 *
 * Numeric range keywords are also stripped (see `UNSUPPORTED_NUMBER_KEYWORDS`
 * below) — discovered via the Phase 2 live-API gate (V0_PLAN.md): a `number`
 * schema with `minimum`/`maximum` (from `ConfidencePatchOpSchema`'s
 * `z.number().min(0).max(1)`, beliefState.ts/tokenPatch.ts) makes every live
 * turn fail with `400 tools.0.custom: For 'number' type, properties maximum,
 * minimum are not supported`. This is purely a JSON-Schema-shape restriction
 * on what Claude's tool API will accept in a tool *definition* — it does not
 * relax the actual constraint: `protocolValidation.ts` still re-validates
 * every `update_beliefs` call against the full `TokenPatchSchema` (min/max
 * included) after the model responds, so an out-of-range confidence value is
 * still rejected server-side and triggers the one-corrective-retry path.
 * The system prompt (systemPrompt.ts, "Confidence-scale semantics") already
 * states the 0-to-1 bound in prose, so the model isn't left without the
 * constraint — only the (rejected) machine-readable copy of it is dropped.
 *
 * A second live-API-only failure (also caught by the Phase 2 gate, after
 * fixing the first): `interact`'s input schema is `InteractInputSchema`, a
 * `z.discriminatedUnion` (ask | propose) — Zod's JSON Schema output for a
 * top-level union is `{"oneOf": [...]}` (no top-level `type`). Adding a
 * sibling `"type": "object"` still 400s: `input_schema: input_schema does
 * not support oneOf, allOf, or anyOf at the top level` — Anthropic's tool
 * API rejects these keywords at the schema *root* unconditionally, not just
 * when `type` is missing (confirmed against the live API, not just from the
 * error string). `flattenTopLevelUnion` below merges the union's branches
 * into one flat object schema instead: every field from every branch is
 * present in `properties`/`required` (satisfying strict mode's
 * "required lists every property" rule), and a field that only exists on
 * some branches becomes nullable (`{"anyOf": [<original>, {"type": "null"}]}`)
 * rather than conditionally required. The model is still constrained to
 * exactly the ask/propose shapes via `mode`'s enum plus the system prompt's
 * description of each mode's fields — this is a JSON-Schema-shape
 * concession for the tool *definition* only. `protocolValidation.ts` re-
 * validates every `interact` call against the real `InteractInputSchema`
 * discriminated union after the model responds, so a call with a field from
 * the wrong branch still fails schema validation and triggers the
 * corrective-retry path exactly as before this change.
 */
import { z } from "zod";
import {
  UpdateBeliefsInputSchema,
  InteractInputSchema,
  ExportDesignMdInputSchema,
  TOOL_NAMES,
} from "./tools";

type JsonSchemaObject = Record<string, unknown>;

/** JSON Schema keywords Anthropic's tool `input_schema` validator rejects on
 * `number`/`integer` nodes (confirmed via a live 400: "For 'number' type,
 * properties maximum, minimum are not supported"). Stripping the exclusive
 * variants too, proactively — same rejected class of keyword, untested
 * against the live API otherwise since no current schema happens to emit
 * them, but a future numeric range added via `.min()`/`.max()`/
 * `.gt()`/`.lt()` would hit the identical failure mode. */
const UNSUPPORTED_NUMBER_KEYWORDS = new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
]);

/** JSON Schema keywords Anthropic's tool `input_schema` validator rejects on
 * `array` nodes when the value isn't 0 or 1 (confirmed via a live 400: "For
 * 'array' type, 'minItems' values other than 0 or 1 are not supported (got:
 * [2, 5])" — from ProposalVariantSchema's `z.array(...).min(2).max(4)` on
 * `interact`'s `variants` field). Same class of restriction as the number
 * bounds above, and the same non-loosening argument applies:
 * `protocolValidation.ts` still re-validates every `interact` call against
 * the real `ProposeInteractionSchema` (2-4 variants) after the model
 * responds. `maxItems` is stripped alongside it — untested with a >1 value
 * against the live API in isolation, but grouped with `minItems` since
 * Anthropic's own error message names both as governed by the same
 * restriction ("values other than 0 or 1"). */
const UNSUPPORTED_ARRAY_ITEM_COUNT_KEYWORDS = new Set(["minItems", "maxItems"]);
const ALLOWED_ARRAY_ITEM_COUNT_VALUES = new Set([0, 1]);

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
    // Only a *true* object schema (one that actually declares `properties`)
    // gets additionalProperties/required stamped — a union root that's
    // `{"type": "object", "oneOf": [...]}` (see `ensureObjectRoot` below) has
    // no properties of its own to enumerate; each branch inside the oneOf is
    // itself walked and stamped on its own recursive pass.
    if (out.type === "object" && out.properties !== undefined) {
      out.additionalProperties = false;
      const props = (out.properties as JsonSchemaObject | undefined) ?? {};
      out.required = Object.keys(props);
    }
    if (out.type === "number" || out.type === "integer") {
      for (const keyword of UNSUPPORTED_NUMBER_KEYWORDS) {
        delete out[keyword];
      }
    }
    if (out.type === "array") {
      for (const keyword of UNSUPPORTED_ARRAY_ITEM_COUNT_KEYWORDS) {
        if (typeof out[keyword] === "number" && !ALLOWED_ARRAY_ITEM_COUNT_VALUES.has(out[keyword] as number)) {
          delete out[keyword];
        }
      }
    }
    return out;
  }
  return node;
}

/**
 * Merges a top-level `oneOf`/`anyOf` of object schemas into one flat object
 * schema (see the module doc comment for why: Anthropic's tool API rejects
 * `oneOf`/`allOf`/`anyOf` at the input_schema root, full stop — no `type`
 * sibling makes it acceptable). No-op for any node that isn't a bare
 * top-level union (every other schema in this codebase's tool set is
 * already a plain object schema and passes through unchanged).
 *
 * Per property across branches:
 *  - present in every branch with an identical schema -> kept as-is, required
 *  - present in only some branches, or with differing schemas -> unioned
 *    with `{"type": "null"}` (nullable) and still listed in `required`
 *    (strict mode requires every property to be required; "this turn's mode
 *    doesn't use this field" is expressed as `null`, not an absent key)
 */
function flattenTopLevelUnion(node: JsonSchemaObject): JsonSchemaObject {
  const branches = (node.oneOf ?? node.anyOf) as JsonSchemaObject[] | undefined;
  if (!Array.isArray(branches) || branches.length === 0) return node;
  if (!branches.every((b) => b.type === "object")) return node;

  const allKeys = new Set<string>();
  for (const branch of branches) {
    const props = (branch.properties as JsonSchemaObject | undefined) ?? {};
    for (const key of Object.keys(props)) allKeys.add(key);
  }

  const mergedProperties: JsonSchemaObject = {};
  for (const key of allKeys) {
    const schemasForKey = branches.map(
      (b) => (b.properties as JsonSchemaObject | undefined)?.[key],
    );
    const presentInEvery = schemasForKey.every((s) => s !== undefined);
    const allIdentical = schemasForKey.every(
      (s) => JSON.stringify(s) === JSON.stringify(schemasForKey[0]),
    );

    if (presentInEvery && allIdentical) {
      mergedProperties[key] = schemasForKey[0];
    } else {
      mergedProperties[key] = {
        anyOf: [
          ...schemasForKey
            .filter((s): s is JsonSchemaObject => s !== undefined)
            .filter(
              (s, i, arr) => arr.findIndex((o) => JSON.stringify(o) === JSON.stringify(s)) === i,
            ),
          { type: "null" },
        ],
      };
    }
  }

  const { oneOf: _oneOf, anyOf: _anyOf, ...rest } = node;
  void _oneOf;
  void _anyOf;
  return {
    ...rest,
    type: "object",
    properties: mergedProperties,
    required: Object.keys(mergedProperties),
    additionalProperties: false,
  };
}

export function zodToStrictJsonSchema(schema: z.ZodType): JsonSchemaObject {
  const raw = z.toJSONSchema(schema, { target: "draft-7" }) as JsonSchemaObject;
  const strict = enforceStrict(raw) as JsonSchemaObject;
  return flattenTopLevelUnion(strict);
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
