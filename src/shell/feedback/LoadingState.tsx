/**
 * Branded full-pane loader shown while a session is starting up. Chrome-only
 * (`--app-*` token family).
 */
"use client";

import { StudioLogo } from "../Logo";

export function LoadingState({ label = "Starting your session…" }: { label?: string }) {
  return (
    <div
      className="flex h-dvh w-full flex-col items-center justify-center gap-3 bg-app-bg"
      data-testid="session-loading"
    >
      <div className="animate-pulse">
        <StudioLogo size={32} />
      </div>
      <span className="text-sm text-app-text-muted">{label}</span>
    </div>
  );
}
