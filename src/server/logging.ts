/**
 * Per-turn dev logging of token usage and latency (V0_PLAN.md Workstream C:
 * "per-turn dev logging of token usage incl. cache_read_input_tokens and
 * latency"; AGENTS.md prompt-caching verification note).
 *
 * Deliberately trivial (console.log, gated on NODE_ENV) — this is a dev
 * observability aid, not a metrics pipeline. Kept in its own module so the
 * turn runner doesn't hardcode a logging strategy and so tests can assert
 * on the shape of what would be logged without depending on console output.
 */
import type Anthropic from "@anthropic-ai/sdk";

export interface TurnLogEntry {
  turnIndex: number;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  retried: boolean;
  stopReason: string | null;
}

export function buildTurnLogEntry(params: {
  turnIndex: number;
  latencyMs: number;
  usage: Anthropic.Usage;
  retried: boolean;
  stopReason: string | null;
}): TurnLogEntry {
  return {
    turnIndex: params.turnIndex,
    latencyMs: params.latencyMs,
    inputTokens: params.usage.input_tokens,
    outputTokens: params.usage.output_tokens,
    cacheReadInputTokens: params.usage.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: params.usage.cache_creation_input_tokens ?? 0,
    retried: params.retried,
    stopReason: params.stopReason,
  };
}

/** Dev-only console logger. No-op when NODE_ENV === "production" so it
 * never becomes a source of noisy prod logs by accident. */
export function logTurn(entry: TurnLogEntry): void {
  if (process.env.NODE_ENV === "production") return;
  console.log(
    `[turn ${entry.turnIndex}] latency=${entry.latencyMs}ms ` +
      `input=${entry.inputTokens} output=${entry.outputTokens} ` +
      `cache_read=${entry.cacheReadInputTokens} cache_creation=${entry.cacheCreationInputTokens} ` +
      `retried=${entry.retried} stop_reason=${entry.stopReason ?? "?"}`,
  );
}
