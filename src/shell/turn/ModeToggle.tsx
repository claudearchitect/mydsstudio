/**
 * Mode toggle — visible chrome control letting the user pick between
 * "Live" (real /api/turn, requires ANTHROPIC_API_KEY) and "Demo" (the
 * scripted fake-agent driver, no key required). Backs the coordinator's
 * Phase 2 scope addition: "Expose it as a visible toggle in the shell."
 *
 * Deliberately tiny and chrome-styled (`--app-*` only — this lives in the
 * shell, not the preview subtree). Disabled while a turn is streaming (same
 * one-in-flight-turn rule as everything else that could change the turn
 * source mid-flight).
 */
"use client";

import type { TurnMode } from "./useTurnMode";

export interface ModeToggleProps {
  mode: TurnMode;
  liveAvailable: boolean;
  resolved: boolean;
  disabled?: boolean;
  onChange: (mode: TurnMode) => void;
}

export function ModeToggle({ mode, liveAvailable, resolved, disabled, onChange }: ModeToggleProps) {
  return (
    <div
      className="flex items-center gap-1 rounded-app-pill border border-app-border bg-app-bg-input p-0.5"
      data-testid="mode-toggle"
      data-mode={mode}
      title={
        liveAvailable
          ? "Live mode calls the real Claude API. Demo mode plays a scripted interview — no API key needed."
          : "No ANTHROPIC_API_KEY detected — live mode is unavailable this session. Demo mode plays a scripted interview."
      }
    >
      <button
        type="button"
        disabled={disabled || !resolved || !liveAvailable}
        onClick={() => onChange("live")}
        data-testid="mode-toggle-live"
        aria-pressed={mode === "live"}
        className={
          "rounded-app-pill px-2.5 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 " +
          (mode === "live"
            ? "bg-app-accent text-white"
            : "text-app-text-secondary hover:text-app-text")
        }
      >
        Live
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("demo")}
        data-testid="mode-toggle-demo"
        aria-pressed={mode === "demo"}
        className={
          "rounded-app-pill px-2.5 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 " +
          (mode === "demo"
            ? "bg-app-accent text-white"
            : "text-app-text-secondary hover:text-app-text")
        }
      >
        Demo
      </button>
    </div>
  );
}
