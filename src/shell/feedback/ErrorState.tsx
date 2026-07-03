/**
 * Full-pane fallback error for catastrophic states (whole session/pane
 * failed to load or recover). Chrome-only (`--app-*` token family).
 */
"use client";

import { friendlyError } from "./errorCopy";

export interface ErrorStateProps {
  code: string;
  message?: string;
  onRetry?: () => void;
  onSwitchToDemo?: () => void;
}

export function ErrorState({ code, message, onRetry, onSwitchToDemo }: ErrorStateProps) {
  const friendly = friendlyError(code, message);

  return (
    <div
      className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-app-bg px-6 text-center"
      data-testid="error-state"
    >
      <WarningGlyph className="h-10 w-10 text-app-text-muted" />

      <div className="flex max-w-sm flex-col gap-1.5">
        <span className="text-base font-medium text-app-text">{friendly.title}</span>
        <span className="text-sm text-app-text-secondary">{friendly.description}</span>
        {message && <span className="text-xs text-app-text-muted">{message}</span>}
      </div>

      {(onRetry && friendly.canRetry) || (friendly.suggestDemo && onSwitchToDemo) ? (
        <div className="flex gap-2">
          {onRetry && friendly.canRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-app-pill bg-app-accent px-4 py-1.5 text-sm text-white transition hover:bg-app-accent-hover"
              data-testid="error-state-retry"
            >
              Retry
            </button>
          )}
          {friendly.suggestDemo && onSwitchToDemo && (
            <button
              type="button"
              onClick={onSwitchToDemo}
              className="rounded-app-pill bg-app-bg-input px-4 py-1.5 text-sm text-app-text-secondary transition hover:text-app-text"
              data-testid="error-state-demo"
            >
              Use demo mode
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function WarningGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M12 3.5 L21.5 20 H2.5 Z"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <line x1="12" y1="9.5" x2="12" y2="14" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" />
    </svg>
  );
}
