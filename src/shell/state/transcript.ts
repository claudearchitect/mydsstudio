/**
 * Transcript — the shell's own UI-facing history of what happened this
 * session (chat bubbles, interaction cards, outgoing messages). Distinct
 * from `BeliefState.events` (the model's append-only log, frozen contract):
 * the transcript is a rendering convenience owned entirely by Workstream B
 * and safe to reshape without touching contracts.
 */
import type { Interaction, NormalizedMessage } from "@/contracts";

export interface UserMessageEntry {
  kind: "userMessage";
  id: string;
  message: NormalizedMessage;
  ts: string;
}

export interface AgentInteractionEntry {
  kind: "agentInteraction";
  id: string;
  interaction: Interaction;
  deltaText?: string;
  ts: string;
  /** True iff this turn was confident completion (the agent called
   * export_design_md) — see turn/turnAgent.ts's TurnAgentSuccess.completed.
   * Drives the Export CTA surfaced in the chat panel (Phase 2: "Completion
   * state"). */
  completed?: boolean;
}

export interface AgentErrorEntry {
  kind: "agentError";
  id: string;
  code: string;
  message: string;
  ts: string;
}

export type TranscriptEntry =
  | UserMessageEntry
  | AgentInteractionEntry
  | AgentErrorEntry;

let counter = 0;
export function nextTranscriptId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
