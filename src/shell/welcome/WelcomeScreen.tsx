/**
 * WelcomeScreen — the landing / empty-state screen shown before an
 * interview session starts (V0_PLAN.md Workstream B "Session UI shell").
 * A warm, Claude-desktop-style hero: wordmark, tagline, a short pitch, a
 * live/demo mode selector, and an optional "resume last session" card.
 * Purely presentational chrome — uses the `--app-*` token family only,
 * never `--ds-*` (that namespace belongs to the belief-state preview).
 */
"use client";

import { useState } from "react";
import { StudioLogo } from "../Logo";

export interface WelcomeScreenProps {
  /** Whether live (real Claude API) mode is available this session. */
  liveAvailable: boolean;
  /** True if there's a saved session that can be resumed. */
  hasResumableSession: boolean;
  /** Summary of the resumable session (present when hasResumableSession). */
  resumeSummary?: { product?: string; savedAt?: string };
  /** Start a fresh interview in the chosen mode. */
  onStart: (mode: "live" | "demo") => void;
  /** Resume the saved session. */
  onResume?: () => void;
}

const FEATURES = [
  "Conversational interview",
  "Live token preview",
  "Export design.md",
];

/** Formats an ISO timestamp as a short relative-time label. Guards
 * missing/invalid input by returning null so callers can fall back. */
function relativeTime(iso: string | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;

  const diffMs = Date.now() - then;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;

  const diffDays = Math.round(diffHr / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export function WelcomeScreen({
  liveAvailable,
  hasResumableSession,
  resumeSummary,
  onStart,
  onResume,
}: WelcomeScreenProps): React.JSX.Element {
  const [mode, setMode] = useState<"live" | "demo">(
    liveAvailable ? "live" : "demo",
  );

  const savedLabel = relativeTime(resumeSummary?.savedAt);

  return (
    <div className="flex h-full min-h-screen w-full items-center justify-center bg-app-bg px-6 py-12">
      <div className="flex w-full max-w-[600px] flex-col items-center gap-10 text-center">
        <div className="flex flex-col items-center gap-4">
          <StudioLogo size={40} />
          <h1 className="text-lg font-semibold tracking-tight text-app-text">
            MyDS Studio
          </h1>
          <p className="text-base text-app-text-secondary">
            Discover a design system by interview, not by form.
          </p>
        </div>

        <p className="max-w-[520px] text-sm leading-relaxed text-app-text-muted">
          Describe your product in plain language, then answer a mix of chat
          and visual questions. Watch a design system resolve token by token
          in a live preview as you go, then export the result as a
          ready-to-use <span className="text-app-text-secondary">design.md</span>.
        </p>

        <ul className="flex flex-col items-start gap-2 self-center">
          {FEATURES.map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-2 text-sm text-app-text-secondary"
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-accent"
              />
              {feature}
            </li>
          ))}
        </ul>

        {hasResumableSession && (
          <div
            className="flex w-full items-center justify-between gap-4 rounded-app-lg bg-app-bg-raised px-5 py-4 text-left shadow-app-card"
            data-testid="welcome-resume-card"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium uppercase tracking-wide text-app-text-muted">
                Resume your last session
              </span>
              <span className="text-sm font-medium text-app-text">
                {resumeSummary?.product || "Untitled session"}
              </span>
              {savedLabel && (
                <span className="text-xs text-app-text-muted">
                  Saved {savedLabel}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onResume}
              data-testid="welcome-resume"
              className="shrink-0 rounded-app-pill px-4 py-2 text-xs font-medium text-app-text shadow-app-edge transition hover:text-app-accent"
            >
              Resume
            </button>
          </div>
        )}

        <div className="flex flex-col items-center gap-4">
          <div
            className="inline-flex items-center gap-1 rounded-app-pill p-1 shadow-app-edge"
            role="group"
            aria-label="Interview mode"
          >
            <button
              type="button"
              disabled={!liveAvailable}
              onClick={() => liveAvailable && setMode("live")}
              data-testid="welcome-mode-live"
              aria-pressed={mode === "live"}
              className={`rounded-app-pill px-4 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                mode === "live"
                  ? "bg-app-accent text-white"
                  : "text-app-text-secondary hover:text-app-text"
              }`}
            >
              Live
            </button>
            <button
              type="button"
              onClick={() => setMode("demo")}
              data-testid="welcome-mode-demo"
              aria-pressed={mode === "demo"}
              className={`rounded-app-pill px-4 py-1.5 text-xs font-medium transition ${
                mode === "demo"
                  ? "bg-app-accent text-white"
                  : "text-app-text-secondary hover:text-app-text"
              }`}
            >
              Demo
            </button>
          </div>
          {!liveAvailable && (
            <span className="text-xs text-app-text-muted">
              No API key — demo only
            </span>
          )}

          <button
            type="button"
            onClick={() => onStart(mode)}
            data-testid="welcome-start"
            className="rounded-app-pill bg-app-accent px-6 py-2.5 text-sm font-medium text-white transition hover:bg-app-accent-hover"
          >
            Start interview
          </button>
        </div>
      </div>
    </div>
  );
}
