/**
 * Anthropic tool definitions for the three-tool protocol
 * (V0_PLAN.md Workstream C: "Tool definitions for the three tools — strict
 * schemas generated from/checked against the contract Zod definitions").
 *
 * Schemas come exclusively from `buildToolDefinitions()` in
 * `@/contracts/toJsonSchema` — this module only attaches descriptions (for
 * the model) and `strict: true`, and serializes the array in a fixed order
 * so it renders identically on every turn (prompt-cache hygiene: AGENTS.md
 * "Serialize tools deterministically").
 */
import type Anthropic from "@anthropic-ai/sdk";
import { buildToolDefinitions, TOOL_NAMES } from "@/contracts";

const TOOL_DESCRIPTIONS: Record<string, string> = {
  [TOOL_NAMES.updateBeliefs]:
    "Commit your interpretation of the latest turn to the shared belief-state document. This is the sole write path to the design system's state — required every turn (the patch may be empty, meaning no belief change this turn, but the call itself must still happen). `patch.tokens` writes DTCG-style token values; `patch.confidence` overwrites a group's confidence scalar outright (no averaging — you own the number); `patch.rationale` adds or replaces (by id) a living rationale claim; `patch.meta` updates product/audience/personality. Call this exactly once per turn, in parallel with exactly one `interact` call, before you decide what to ask or propose next.",
  [TOOL_NAMES.interact]:
    "Choose exactly one interaction for this turn: `mode: \"ask\"` for a natural-language question (with optional quick-reply chips — the client always also offers free text, so you do not need to engineer an escape hatch into the chips themselves), or `mode: \"propose\"` for a visual pick among 2-4 token-patch variants that vary a single named axis on one target component. Call this exactly once per turn, in parallel with exactly one `update_beliefs` call.",
  [TOOL_NAMES.exportDesignMd]:
    "Serialize the current belief state to a design.md document. Call this only when the user explicitly asks to export, or when you have reached confident completion across the parameter space and are signaling the interview is done. Takes no arguments. Do not call this in the same turn as `interact` — it replaces `interact` for that turn.",
};

/** Fixed order — do not derive from object key iteration elsewhere, and do
 * not reorder. Tool order is part of the cached prefix (AGENTS.md: adding,
 * removing, or reordering a tool invalidates the whole cache). */
const TOOL_ORDER = [
  TOOL_NAMES.updateBeliefs,
  TOOL_NAMES.interact,
  TOOL_NAMES.exportDesignMd,
] as const;

/**
 * Builds the Anthropic `tools` array for `messages.create`/`messages.stream`.
 * Deterministic: same input schemas (frozen contracts) + same descriptions +
 * same order => byte-identical JSON every call.
 */
export function buildAnthropicTools(): Anthropic.Tool[] {
  const defs = buildToolDefinitions();
  const byName = new Map(defs.map((d) => [d.name, d]));

  return TOOL_ORDER.map((name) => {
    const def = byName.get(name);
    if (!def) {
      throw new Error(`buildAnthropicTools: missing tool definition for "${name}"`);
    }
    return {
      name: def.name,
      description: TOOL_DESCRIPTIONS[name],
      // input_schema from buildToolDefinitions() is already strict
      // (additionalProperties:false, required on every key, recursively) —
      // see src/contracts/toJsonSchema.ts.
      input_schema: def.input_schema as Anthropic.Tool.InputSchema,
      strict: true,
    } satisfies Anthropic.Tool;
  });
}
