/**
 * useTurnMode — decides whether the shell drives turns via the real
 * `/api/turn` (live mode) or the scripted fake-agent driver (demo mode),
 * per the coordinator's Phase 2 scope addition: "Promote the existing
 * fake-agent path from a test-only stand-in into a real, user-facing 'demo
 * mode' ... Expose it as a visible toggle in the shell AND make it the
 * automatic fallback when ANTHROPIC_API_KEY/live /api/turn is unavailable,
 * so someone can clone and run the demo with zero setup."
 *
 * Resolution order (mode is only ever computed *before* the stateful
 * session mounts — see Session.tsx's `!resolved` early return — so there is
 * no "flip after mount" case to guard against; this hook's whole job is to
 * make that one resolution deterministic):
 *  1. A user's explicit choice this session (`setMode`) always wins.
 *  2. An auto-demotion this session (`reportLiveFailure`, below) wins next.
 *  3. Otherwise, probe `GET /api/turn/health` (never exposes the key
 *     itself, see that route) — live if a key is configured, demo if not.
 *  4. While the probe is in flight, `resolved` is false and Session.tsx
 *     renders a loading state rather than guessing — see that file's
 *     comment on why a provisional mount is the bug class this avoids.
 *
 * `reportLiveFailure` lets the session hook demote to demo mid-session if a
 * live turn fails in a way that suggests the key/route itself is unusable
 * (server_error / network_error / bad_request on the very first turn) —
 * this is what makes demo mode "the automatic fallback" in practice, not
 * just at mount. Bug this hook used to have (root-caused during the demo/
 * live polish pass): the demotion lived only in `explicitMode` state, which
 * is plain useState — gone on the next page load. A fresh mount would
 * re-resolve straight back to "live" (the health probe still says
 * available), the very same kickoff turn would fail the very same way, and
 * `reportLiveFailure` would fire again — an every-reload flash-live-then-
 * silently-demote loop that read as "stuck on Demo" with a seemingly
 * healthy key. `autoDemoted` below is now surfaced (not hidden inside
 * `explicitMode`) specifically so the shell can show *why* it's in Demo,
 * and `retryLive` gives the user an explicit way back to Live without a
 * full reload silently re-triggering the same failure.
 */
"use client";

import { useCallback, useEffect, useState } from "react";

export type TurnMode = "live" | "demo";

export interface UseTurnModeResult {
  mode: TurnMode;
  /** True once the health probe has resolved (or failed) — before this,
   * `mode` is not yet meaningful; Session.tsx doesn't mount the stateful
   * session until this is true. */
  resolved: boolean;
  /** True if a live key was detected as configured server-side. Drives
   * whether the shell's toggle offers "Live" as a real option at all. */
  liveAvailable: boolean;
  /** Set when `reportLiveFailure` has demoted this session away from Live —
   * distinct from the user picking Demo themselves, so the shell can show
   * an explanatory banner instead of a silent toggle flip. Cleared by
   * `setMode`/`retryLive`. */
  autoDemoted: { code: string } | null;
  setMode: (mode: TurnMode) => void;
  /** Called by the session hook when a live turn fails in a way that
   * suggests live mode itself is broken (not just a transient rate limit) —
   * demotes to demo mode so the user isn't stuck, and records why via
   * `autoDemoted`. */
  reportLiveFailure: (code: string) => void;
  /** Explicit re-arm: clears an auto-demotion and returns to Live. Distinct
   * from `setMode("live")` only in that it also clears `autoDemoted` — kept
   * as its own function so callers don't have to remember to clear both. */
  retryLive: () => void;
}

const DEMOTING_ERROR_CODES = new Set(["server_error", "network_error", "bad_request"]);

export function useTurnMode(): UseTurnModeResult {
  const [explicitMode, setExplicitModeState] = useState<TurnMode | null>(null);
  const [autoDemoted, setAutoDemoted] = useState<{ code: string } | null>(null);
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

  // A user picking a mode explicitly always supersedes an earlier
  // auto-demotion — otherwise clicking "Live" right after an auto-demotion
  // banner would be a no-op (autoDemoted would still out-rank the fresh
  // explicit choice in `mode`'s resolution below).
  const setMode = useCallback((next: TurnMode) => {
    setAutoDemoted(null);
    setExplicitModeState(next);
  }, []);

  const reportLiveFailure = useCallback((code: string) => {
    if (!DEMOTING_ERROR_CODES.has(code)) return;
    setAutoDemoted({ code });
    setExplicitModeState(null);
  }, []);

  const retryLive = useCallback(() => {
    setAutoDemoted(null);
    setExplicitModeState("live");
  }, []);

  const mode: TurnMode = explicitMode ?? (autoDemoted ? "demo" : resolved && liveAvailable ? "live" : "demo");

  return {
    mode,
    resolved,
    liveAvailable,
    autoDemoted,
    setMode,
    reportLiveFailure,
    retryLive,
  };
}
