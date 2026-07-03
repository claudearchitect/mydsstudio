/**
 * useTurnMode — decides whether the shell drives turns via the real
 * `/api/turn` (live mode) or the scripted fake-agent driver (demo mode),
 * per the coordinator's Phase 2 scope addition: "Promote the existing
 * fake-agent path from a test-only stand-in into a real, user-facing 'demo
 * mode' ... Expose it as a visible toggle in the shell AND make it the
 * automatic fallback when ANTHROPIC_API_KEY/live /api/turn is unavailable,
 * so someone can clone and run the demo with zero setup."
 *
 * Resolution order:
 *  1. A user's explicit choice this session (`setMode`) always wins.
 *  2. Otherwise, probe `GET /api/turn/health` (never exposes the key
 *     itself, see that route) — live if a key is configured, demo if not.
 *  3. While the probe is in flight, default to demo so the app is
 *     immediately interactive (no spinner-gated cold start) — if the probe
 *     comes back "available", the effect flips to live automatically
 *     unless the user has since made an explicit choice.
 *
 * `reportLiveFailure` lets the session hook demote to demo mid-session if a
 * live turn fails in a way that suggests the key/route itself is unusable
 * (server_error / network_error / bad_request on the very first turn) —
 * this is what makes demo mode "the automatic fallback" in practice, not
 * just at mount.
 */
"use client";

import { useCallback, useEffect, useState } from "react";

export type TurnMode = "live" | "demo";

export interface UseTurnModeResult {
  mode: TurnMode;
  /** True once the health probe has resolved (or failed) — before this,
   * `mode` is a provisional "demo" default. */
  resolved: boolean;
  /** True if a live key was detected as configured server-side. Drives
   * whether the shell's toggle offers "Live" as a real option at all. */
  liveAvailable: boolean;
  setMode: (mode: TurnMode) => void;
  /** Called by the session hook when a live turn fails in a way that
   * suggests live mode itself is broken (not just a transient rate limit) —
   * demotes to demo mode so the user isn't stuck. */
  reportLiveFailure: (code: string) => void;
}

const DEMOTING_ERROR_CODES = new Set(["server_error", "network_error", "bad_request"]);

export function useTurnMode(): UseTurnModeResult {
  const [explicitMode, setExplicitMode] = useState<TurnMode | null>(null);
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/turn/health")
      .then((res) => (res.ok ? res.json() : { available: false }))
      .then((data: { available?: boolean }) => {
        if (cancelled) return;
        setLiveAvailable(Boolean(data.available));
        setResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLiveAvailable(false);
        setResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reportLiveFailure = useCallback((code: string) => {
    if (DEMOTING_ERROR_CODES.has(code)) {
      setExplicitMode("demo");
    }
  }, []);

  const mode: TurnMode = explicitMode ?? (resolved && liveAvailable ? "live" : "demo");

  return {
    mode,
    resolved,
    liveAvailable,
    setMode: setExplicitMode,
    reportLiveFailure,
  };
}
