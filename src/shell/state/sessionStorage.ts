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
 *
 * Keyed per turn-mode ("live" vs "demo", see turn/useTurnMode.ts): the two
 * modes drive fundamentally different turn sources (RealTurnAgent's
 * `/api/turn` bookkeeping vs FakeTurnAgent's scripted driver), each authored
 * to start from an empty belief state (Session.tsx's doc comment: "there's
 * no coherent way to splice a mid-session belief state into either turn
 * source in the other's shoes"). A single shared key let a demo session's
 * transcript get restored into a live-mode mount (and vice versa) whenever
 * mode resolution changed between page loads — e.g. the live health probe
 * flips from unavailable to available, or a live turn fails and demotes to
 * demo — which produced a stuck-looking shell: the restored transcript's
 * `kickedOffRef` latch (useSession.ts) skips the kickoff turn entirely, so
 * the wrong turn source's stale history sits there with no way to progress.
 * Namespacing the storage key by mode makes the two sessions fully
 * independent, so a mode switch always resumes (or starts fresh) the
 * correct session.
 */
import { BeliefStateSchema, type BeliefState } from "@/contracts";
import type { TranscriptEntry } from "./transcript";

const STORAGE_KEY_PREFIX = "mydsstudio:session:v1";

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

/** Mirrors turn/useTurnMode.ts's TurnMode without importing it — this module
 * is a low-level storage primitive and shouldn't pull in the mode-resolution
 * hook (and its own "use client" + fetch-health-probe baggage) just for a
 * union of two string literals. */
export type SessionStorageMode = "live" | "demo";

function storageKey(mode: SessionStorageMode): string {
  return `${STORAGE_KEY_PREFIX}:${mode}`;
}

export function saveSession(
  mode: SessionStorageMode,
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
    window.localStorage.setItem(storageKey(mode), JSON.stringify(payload));
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
export function restoreSession(mode: SessionStorageMode): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(mode));
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

export function clearSession(mode: SessionStorageMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(mode));
  } catch {
    // ignore
  }
}

/** Exposed for tests/debugging that need the literal key a given mode
 * resolves to (e.g. seeding/inspecting localStorage directly). */
export function sessionStorageKeyFor(mode: SessionStorageMode): string {
  return storageKey(mode);
}
