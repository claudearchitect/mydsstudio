/**
 * Event-log tail management (V0_PLAN.md Workstream C: "recent events
 * verbatim; older summarized — size threshold is fine for V0") and event id
 * generation. The server is the sole generator of event ids — the model
 * never invents them (IMPLEMENTATION.md #2/#3: provenance and rationale
 * evidence are event ids stamped by the server).
 */
import type { BeliefEvent } from "@/contracts";

/** Below this many events, the whole log renders verbatim — no summary
 * needed. Chosen generously for V0's ~10-15 turn sessions (V0_PLAN.md goal):
 * a full session rarely exceeds this, so summarization is mostly inert
 * until a session runs unusually long. */
const VERBATIM_THRESHOLD = 24;

/** When summarizing, keep this many of the most recent events verbatim and
 * fold everything older into one summary line. */
const VERBATIM_TAIL_SIZE = 16;

let eventCounter = 0;

/** Resets the module-local event id counter. Test-only — production event
 * ids only need to be unique within a session's lifetime, and the route
 * handler's session state is per-request in V0 (no persistence), so a
 * simple incrementing counter seeded per session is sufficient. */
export function resetEventIdCounterForTests(): void {
  eventCounter = 0;
}

/** Generates the next event id for a session. `seed` lets callers key ids
 * off a stable per-session prefix so ids stay readable in logs/fixtures
 * without needing a UUID dependency. */
export function nextEventId(seed = "e"): string {
  eventCounter += 1;
  return `${seed}${String(eventCounter).padStart(2, "0")}`;
}

export interface EventLogTail {
  /** Events rendered verbatim in the assembled context. */
  verbatim: BeliefEvent[];
  /** One-line human-readable summary of everything older, or null if the
   * whole log fit under the threshold and nothing was summarized. */
  summary: string | null;
}

/**
 * Splits a belief state's event log into a verbatim tail plus an optional
 * summary of older events. Pure and deterministic — same log in, same
 * split out, so it doesn't threaten prompt-cache byte-stability of
 * anything built from a given state.
 */
export function summarizeEventLog(events: BeliefEvent[]): EventLogTail {
  if (events.length <= VERBATIM_THRESHOLD) {
    return { verbatim: events, summary: null };
  }

  const cutoff = events.length - VERBATIM_TAIL_SIZE;
  const older = events.slice(0, cutoff);
  const verbatim = events.slice(cutoff);

  const counts = new Map<BeliefEvent["kind"], number>();
  for (const e of older) {
    counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  }
  const parts = Array.from(counts.entries())
    .map(([kind, n]) => `${n} ${kind}`)
    .join(", ");

  const firstTs = older[0]?.ts;
  const lastTs = older[older.length - 1]?.ts;
  const span = firstTs && lastTs ? ` (${firstTs} to ${lastTs})` : "";

  return {
    verbatim,
    summary: `[${older.length} earlier events summarized${span}: ${parts}. Full history is preserved in rationale and token provenance; only the verbatim tail below is replayed here.]`,
  };
}
