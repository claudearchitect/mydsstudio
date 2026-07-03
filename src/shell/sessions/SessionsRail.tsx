/**
 * Left-hand "previous sessions" navigation rail, Claude-Code-style: a narrow
 * always-visible strip listing past sessions with a prominent "new session"
 * action. Pure presentational chrome — `--app-*` token family only, never
 * `--ds-*`. Receives its data as props (SessionSummary[]) and reports intent
 * upward (`onSelect` / `onNewSession`); it never touches localStorage or
 * belief state itself — the orchestrator wires it to sessionsIndex.ts.
 */
"use client";

import { StudioLogo } from "@/shell/Logo";
import type { SessionSummary } from "./sessionsIndex";

export interface SessionsRailProps {
  sessions: SessionSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewSession: () => void;
}

/** Formats an ISO timestamp as a short relative-time label ("just now",
 * "N min ago", "N hr ago", "N days ago"). Guards invalid dates by falling
 * back to an empty string rather than "NaN ..." or throwing. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const diffMs = Date.now() - then;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;

  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export function SessionsRail({
  sessions,
  activeId,
  onSelect,
  onNewSession,
}: SessionsRailProps): React.JSX.Element {
  return (
    <nav
      className="flex h-full w-[230px] shrink-0 flex-col gap-3 bg-app-bg-deep px-3 py-4"
      data-testid="sessions-rail"
    >
      <div className="flex items-center gap-2 px-1">
        <StudioLogo size={18} />
        <span className="truncate text-sm font-semibold text-app-text">
          MyDS Studio
        </span>
      </div>

      <button
        type="button"
        onClick={onNewSession}
        data-testid="sessions-new"
        className="flex items-center justify-center gap-1.5 rounded-app-md px-3 py-2 text-sm font-medium text-app-text shadow-app-edge transition-colors hover:bg-app-bg-raised"
      >
        <span aria-hidden className="text-app-accent">
          +
        </span>
        New session
      </button>

      <p className="px-1 pt-2 text-xs font-medium uppercase tracking-wide text-app-text-muted">
        Recents
      </p>

      <div className="flex-1 space-y-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <p className="px-1 text-xs text-app-text-muted" data-testid="sessions-empty">
            No previous sessions yet
          </p>
        ) : (
          sessions.map((session) => {
            const isActive = session.id === activeId;
            const timeLabel = relativeTime(session.updatedAt);
            const subtitle = session.subtitle || timeLabel;

            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelect(session.id)}
                data-testid={`session-item-${session.id}`}
                data-active={isActive}
                className={`flex w-full flex-col items-start gap-0.5 rounded-app-sm px-2.5 py-2 text-left transition-colors ${
                  isActive
                    ? "bg-app-bg-raised shadow-app-edge"
                    : "bg-transparent hover:bg-app-bg-raised"
                }`}
              >
                <span className="flex w-full items-center gap-1.5">
                  {isActive && (
                    <span
                      aria-hidden
                      data-testid={`session-item-${session.id}-active-dot`}
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-accent"
                    />
                  )}
                  <span className="truncate text-sm text-app-text">
                    {session.title}
                  </span>
                </span>
                {subtitle && (
                  <span className="truncate text-xs text-app-text-muted">
                    {subtitle}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </nav>
  );
}
