/**
 * Inline chat-column error card shown in the transcript when a turn fails.
 * Chrome-only (`--app-*` token family). Presentational — callers own retry /
 * demo-mode / dismiss behavior; this component only renders and forwards
 * clicks.
 */
"use client";

import { friendlyError } from "./errorCopy";

export interface TurnErrorBannerProps {
  code: string;
  message?: string;
  onRetry: () => void;
  onSwitchToDemo?: () => void;
  onDismiss?: () => void;
}

export function TurnErrorBanner({
  code,
  message,
  onRetry,
  onSwitchToDemo,
  onDismiss,
}: TurnErrorBannerProps) {
  const friendly = friendlyError(code, message);

  return (
    <div
      className="relative flex max-w-[85%] flex-col gap-2 rounded-app-md bg-app-bg-raised px-3 py-2 text-sm shadow-[0_0_0_1px_var(--app-negative),0_2px_8px_rgba(0,0,0,0.24)]"
      data-testid="transcript-error-banner"
    >
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-2 text-app-text-muted transition hover:text-app-text"
          data-testid="error-dismiss"
        >
          ✕
        </button>
      )}

      <div className="flex items-start gap-2 pr-4">
        <WarningGlyph className="mt-0.5 h-4 w-4 shrink-0 text-app-negative" />
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-app-text">{friendly.title}</span>
          <span className="text-app-text-secondary">{friendly.description}</span>
          {message && <span className="text-xs text-app-text-muted">{message}</span>}
        </div>
      </div>

      {(friendly.canRetry || (friendly.suggestDemo && onSwitchToDemo)) && (
        <div className="flex gap-2">
          {friendly.canRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="self-start rounded-app-pill px-3 py-1 text-xs text-app-negative shadow-[0_0_0_1px_var(--app-negative)] transition hover:bg-app-negative hover:text-white"
              data-testid="retry-button"
            >
              Retry
            </button>
          )}
          {friendly.suggestDemo && onSwitchToDemo && (
            <button
              type="button"
              onClick={onSwitchToDemo}
              className="self-start rounded-app-pill bg-app-bg-input px-3 py-1 text-xs text-app-text-secondary transition hover:text-app-text"
              data-testid="error-switch-demo"
            >
              Use demo mode
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function WarningGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M12 3.5 L21.5 20 H2.5 Z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <line x1="12" y1="9.5" x2="12" y2="14" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" />
    </svg>
  );
}
