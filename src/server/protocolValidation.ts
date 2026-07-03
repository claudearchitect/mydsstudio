/**
 * Turn-protocol enforcement (V0_PLAN.md Workstream C: "exactly one
 * update_beliefs + one interact per turn; one corrective retry on
 * violation, then an error SSE event with a machine-readable code";
 * IMPLEMENTATION.md #3 protocol constraint).
 *
 * This module only classifies a model response against the protocol and
 * extracts the validated tool inputs — it does not itself talk to the
 * network or decide retry timing (that's `turnRunner.ts`).
 */
import type Anthropic from "@anthropic-ai/sdk";
import {
  TOOL_NAMES,
  TokenPatchSchema,
  InteractInputSchema,
  ExportDesignMdInputSchema,
  type TokenPatch,
  type Interaction,
} from "@/contracts";

export interface ValidTurnToolCalls {
  ok: true;
  updateBeliefs: { toolUseId: string; patch: TokenPatch };
  /** Present when the turn's second call was `interact`. Mutually
   * exclusive with `exportDesignMd`. */
  interact?: { toolUseId: string; interaction: Interaction };
  /** Present when the turn's second call was `export_design_md`. Mutually
   * exclusive with `interact`. */
  exportDesignMd?: { toolUseId: string };
}

export interface InvalidTurnToolCalls {
  ok: false;
  /** Human-readable diagnostic — used in the corrective retry message and
   * in logs. Not shown to the end user verbatim. */
  reason: string;
}

export type TurnToolCallsResult = ValidTurnToolCalls | InvalidTurnToolCalls;

/**
 * Validates that a model response contains exactly one `update_beliefs`
 * call and exactly one of (`interact` | `export_design_md`), with no other
 * tool calls, and that each tool's `input` parses against its Zod schema.
 * `tool_use.input` is read as the SDK's already-parsed object (AGENTS.md:
 * "tool_use.input is already parsed. Read it as the SDK's object — never
 * string-match serialized JSON") — no JSON.parse anywhere in this function.
 */
export function validateTurnToolCalls(content: Anthropic.ContentBlock[]): TurnToolCallsResult {
  const toolUses = content.filter(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );

  const updateBeliefsCalls = toolUses.filter((t) => t.name === TOOL_NAMES.updateBeliefs);
  const interactCalls = toolUses.filter((t) => t.name === TOOL_NAMES.interact);
  const exportCalls = toolUses.filter((t) => t.name === TOOL_NAMES.exportDesignMd);
  const unknownCalls = toolUses.filter(
    (t) =>
      t.name !== TOOL_NAMES.updateBeliefs &&
      t.name !== TOOL_NAMES.interact &&
      t.name !== TOOL_NAMES.exportDesignMd,
  );

  if (unknownCalls.length > 0) {
    return {
      ok: false,
      reason: `unrecognized tool call(s): ${unknownCalls.map((t) => t.name).join(", ")}`,
    };
  }

  if (updateBeliefsCalls.length !== 1) {
    return {
      ok: false,
      reason: `expected exactly one update_beliefs call, got ${updateBeliefsCalls.length}`,
    };
  }

  const secondCallCount = interactCalls.length + exportCalls.length;
  if (secondCallCount !== 1) {
    return {
      ok: false,
      reason: `expected exactly one of interact/export_design_md, got ${interactCalls.length} interact + ${exportCalls.length} export_design_md`,
    };
  }

  const updateBeliefsBlock = updateBeliefsCalls[0];
  const patchParse = TokenPatchSchema.safeParse(
    (updateBeliefsBlock.input as { patch?: unknown } | undefined)?.patch,
  );
  if (!patchParse.success) {
    return {
      ok: false,
      reason: `update_beliefs input failed schema validation: ${patchParse.error.message}`,
    };
  }

  if (interactCalls.length === 1) {
    const interactParse = InteractInputSchema.safeParse(interactCalls[0].input);
    if (!interactParse.success) {
      return {
        ok: false,
        reason: `interact input failed schema validation: ${interactParse.error.message}`,
      };
    }
    return {
      ok: true,
      updateBeliefs: { toolUseId: updateBeliefsBlock.id, patch: patchParse.data },
      interact: { toolUseId: interactCalls[0].id, interaction: interactParse.data },
    };
  }

  const exportParse = ExportDesignMdInputSchema.safeParse(exportCalls[0].input);
  if (!exportParse.success) {
    return {
      ok: false,
      reason: `export_design_md input failed schema validation: ${exportParse.error.message}`,
    };
  }
  return {
    ok: true,
    updateBeliefs: { toolUseId: updateBeliefsBlock.id, patch: patchParse.data },
    exportDesignMd: { toolUseId: exportCalls[0].id },
  };
}

/**
 * Builds the corrective retry user-turn text sent back to the model after
 * exactly one protocol violation. Kept short and mechanical — it names the
 * violation and restates the requirement, nothing else.
 */
export function buildCorrectiveRetryText(reason: string): string {
  return [
    "Protocol violation in your previous response: " + reason + ".",
    "",
    "You must call exactly one `update_beliefs` tool (patch may be empty) and exactly one of `interact` or `export_design_md`, in parallel, in a single response. Please retry this turn correctly.",
  ].join("\n");
}
