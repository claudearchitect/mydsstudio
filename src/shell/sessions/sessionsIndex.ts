/**
 * Lightweight localStorage-backed index of past session SUMMARIES (not full
 * belief states) so the sessions rail (SessionsRail.tsx) can list previous
 * sessions without loading their full state. Deliberately a separate
 * localStorage key from the main session snapshot
 * (src/shell/state/sessionStorage.ts's `mydsstudio:session:v1`) — this is
 * just an index of what exists, independently versioned.
 *
 * Chrome-only concern (feeds the `--app-*` rail); persistence here is
 * best-effort, same convention as sessionStorage.ts: guard SSR, wrap in
 * try/catch, never throw, discard malformed data as empty.
 */

export interface SessionSummary {
  id: string;
  title: string; // product name or "Untitled session"
  subtitle?: string; // short status/context line, optional
  updatedAt: string; // ISO timestamp
  status?: "active" | "idle";
}

export const SESSIONS_INDEX_KEY = "mydsstudio:sessions:index:v1";

/** Cap on stored summaries — oldest entries beyond this are dropped on write. */
const MAX_SESSIONS = 20;

function readAll(): SessionSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SESSIONS_INDEX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is SessionSummary =>
        !!entry &&
        typeof entry === "object" &&
        typeof (entry as SessionSummary).id === "string" &&
        typeof (entry as SessionSummary).title === "string" &&
        typeof (entry as SessionSummary).updatedAt === "string",
    );
  } catch {
    return [];
  }
}

function writeAll(sessions: SessionSummary[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(sessions));
  } catch {
    // Persistence is best-effort — never throw.
  }
}

/** Returns stored session summaries, newest first (by `updatedAt` desc).
 * Returns `[]` on SSR or any read/parse failure. */
export function listSessions(): SessionSummary[] {
  const sessions = readAll();
  return [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/** Upserts a summary by id (updating `updatedAt`), capping the stored list
 * at the `MAX_SESSIONS` newest entries. No-op on SSR or storage failure. */
export function recordSession(summary: SessionSummary): void {
  if (typeof window === "undefined") return;
  try {
    const sessions = readAll();
    const withoutExisting = sessions.filter((s) => s.id !== summary.id);
    const next = [...withoutExisting, summary]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, MAX_SESSIONS);
    writeAll(next);
  } catch {
    // no-op — persistence is best-effort
  }
}

/** Removes a session summary by id. No-op on SSR or storage failure. */
export function removeSession(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const sessions = readAll().filter((s) => s.id !== id);
    writeAll(sessions);
  } catch {
    // no-op — persistence is best-effort
  }
}
