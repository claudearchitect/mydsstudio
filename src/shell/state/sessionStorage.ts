/**
 * localStorage snapshot/restore of session state (V0_PLAN.md Workstream B
 * "Session UI shell"). Persists the belief state + a UI-side transcript
 * (chat/interaction history the shell needs to redraw — not part of the
 * frozen BeliefState.events log, which is the model's append-only record).
 *
 * Gated on `schemaVersion`: BeliefState.schemaVersion is a literal 1
 * (src/contracts/beliefState.ts). A mismatched or missing version must be
 * discarded, not crash the app (AGENTS.md invariant list references this
 * requirement explicitly for Workstream B's restore path).
 */
import { BeliefStateSchema, type BeliefState } from "@/contracts";
import type { TranscriptEntry } from "./transcript";

const STORAGE_KEY = "mydsstudio:session:v1";

/** Bump alongside BeliefState.schemaVersion if the persisted envelope shape
 * itself changes in an incompatible way. Independent of BeliefState's own
 * schemaVersion field, which is checked separately below. */
const ENVELOPE_VERSION = 1;

export interface PersistedSession {
  envelopeVersion: number;
  beliefState: BeliefState;
  transcript: TranscriptEntry[];
  savedAt: string;
}

export function saveSession(
  beliefState: BeliefState,
  transcript: TranscriptEntry[],
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedSession = {
      envelopeVersion: ENVELOPE_VERSION,
      beliefState,
      transcript,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage can fail (quota, private mode, disabled) — persistence is a
    // convenience, never a hard requirement for the session to function.
  }
}

/**
 * Restores a session from localStorage. Returns null on: no snapshot,
 * malformed JSON, envelope version mismatch, or a BeliefState whose
 * `schemaVersion` doesn't match the current contract (z.literal(1)) —
 * every failure mode discards silently rather than throwing, per the
 * gate's "discard, not crash" requirement.
 */
export function restoreSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    if (parsed.envelopeVersion !== ENVELOPE_VERSION) return null;

    const beliefStateResult = BeliefStateSchema.safeParse(parsed.beliefState);
    if (!beliefStateResult.success) return null;
    // Redundant with the schema (schemaVersion is z.literal(1)) but kept
    // explicit since it's the exact clause the gate calls out.
    if (beliefStateResult.data.schemaVersion !== 1) return null;

    const transcript = Array.isArray(parsed.transcript) ? parsed.transcript : [];

    return {
      envelopeVersion: ENVELOPE_VERSION,
      beliefState: beliefStateResult.data,
      transcript: transcript as TranscriptEntry[],
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const SESSION_STORAGE_KEY = STORAGE_KEY;
