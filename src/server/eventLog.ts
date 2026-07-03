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

/**
 * Generates the next event id for a session by deriving it from the events
 * already in the belief state, NOT from any process-global counter. This is
 * what keeps ids unique across server restarts, page reloads, and concurrent
 * sessions: the client persists belief state in localStorage and replays it
 * back on every request, so a global counter (which resets to zero on a fresh
 * process) would re-issue ids that already exist in a resumed log —
 * corrupting the provenance/rationale-evidence references that point at them.
 * Deriving `max(existing numeric suffix) + 1` is stable under all of those.
 *
 * `seed` is the id prefix (default "e"); only ids matching `<seed><digits>`
 * participate in the max, so a differently-seeded id never collides.
 */
export function nextEventIdForState(events: BeliefEvent[], seed = "e"): string {
  const pattern = new RegExp(`^${escapeRegExp(seed)}(\\d+)$`);
  let max = 0;
  for (const e of events) {
    const m = pattern.exec(e.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${seed}${String(max + 1).padStart(2, "0")}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
