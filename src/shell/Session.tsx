/**
 * Session — the real (non-placeholder) two-pane session, wiring
 * `useSession` (turn lifecycle, belief state, transcript) into
 * `StudioShell`'s chatSlot/previewSlot, plus the dev inspector panel docked
 * under the chat column, the mode toggle, and the export panel. This is
 * what `src/app/page.tsx` mounts.
 *
 * Turn source (V0_PLAN.md Phase 2 + coordinator's demo-mode scope
 * addition): `useTurnMode` resolves live-vs-demo. Live mode drives
 * `RealTurnAgent` against the real `/api/turn` SSE endpoint; demo mode
 * drives `FakeTurnAgent` over the scripted `dogGroomerFullInterviewScript`
 * — a full, real interview (real applyPatch, real belief patches, a
 * propose turn, a confident-completion turn) rather than a test-only stub,
 * so the whole app is explorable with zero setup. Demo mode is also the
 * automatic fallback when no ANTHROPIC_API_KEY is configured, and
 * mid-session if a live turn fails in a way that suggests live mode itself
 * is broken (see useTurnMode's reportLiveFailure).
 *
 * Switching modes restarts the session (remounted via `key`): the fake
 * agent's script is authored to play from an empty belief state, and
 * `/api/turn` is likewise addressed per-session via its own
 * priorTurns/turnIndex bookkeeping (RealTurnAgent) — there's no coherent
 * way to splice a mid-session belief state into either turn source in the
 * other's shoes, and it isn't a V0 requirement.
 *
 * `useSession`'s localStorage snapshot is namespaced by `mode`
 * (sessionStorage.ts) so a demo session's saved transcript can never be
 * "restored" into a live-mode mount or vice versa — see that file's header
 * comment for the stuck-on-Demo bug this fixes. `autoDemoted` (from
 * useTurnMode) is surfaced here as a dismissible banner with a "Retry Live"
 * action rather than silently flipping the toggle, so a failed first live
 * turn is legible instead of looking like the app is just stuck.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RenderComponent } from "@/contracts";
import { FakeAgentDriver, dogGroomerFullInterviewScript } from "@fixtures/fakeAgent";
import { emptyBeliefState } from "@fixtures/beliefStates";
import { ExportPanel } from "@/export";
import { StudioShell } from "./StudioShell";
import { ChatPanel } from "./chat/ChatPanel";
import { PreviewPane } from "./preview/PreviewPane";
import { DevInspectorPanel } from "./inspector/DevInspectorPanel";
import { WelcomeScreen } from "./welcome/WelcomeScreen";
import { SessionsRail } from "./sessions/SessionsRail";
import { listSessions, recordSession, type SessionSummary } from "./sessions/sessionsIndex";
import { LoadingState } from "./feedback/LoadingState";
import { useSession } from "./turn/useSession";
import { FakeTurnAgent } from "./turn/fakeTurnAgent";
import { RealTurnAgent } from "./turn/realTurnAgent";
import { useTurnMode, type TurnMode } from "./turn/useTurnMode";
import { ModeToggle } from "./turn/ModeToggle";
import {
  normalizeControlMessage,
  normalizeRegionMessage,
} from "./messages/normalize";
import { lookupTokenValue } from "./controls/tokenLookup";
import { restoreSession, clearSession } from "./state/sessionStorage";

export interface SessionProps {
  renderComponent?: RenderComponent;
}

export function Session({ renderComponent }: SessionProps) {
  const turnMode = useTurnMode();

  // Two-phase gate: a "welcome" landing screen precedes the live session.
  // `phase` flips to "active" only once the user starts (fresh) or resumes.
  // `sessionKey` bumps to force a clean SessionInner remount for a fresh
  // start / "new session" even when the resolved mode is unchanged.
  const [phase, setPhase] = useState<"welcome" | "active">("welcome");
  const [sessionKey, setSessionKey] = useState(0);
  const [resume, setResume] = useState<{
    has: boolean;
    summary?: { product?: string; savedAt?: string };
  }>({ has: false });

  // Detect a resumable snapshot on mount (client-only; localStorage is empty
  // server-side). Only a snapshot with real conversation history counts as
  // resumable — mirrors useSession's own restore guard.
  useEffect(() => {
    queueMicrotask(() => {
      const restored = restoreSession(turnMode.mode);
      if (restored && restored.transcript.length > 0) {
        setResume({
          has: true,
          summary: {
            product: restored.beliefState.meta.product || undefined,
            savedAt: restored.savedAt,
          },
        });
      }
    });
  }, [turnMode.mode]);

  // Gate SessionInner behind the health probe (see useTurnMode): rendering it
  // before the probe resolves would construct an agent against a provisional
  // mode and then need a forced remount when the probe flips it. The welcome
  // screen also needs `liveAvailable`, so we wait here for both.
  if (!turnMode.resolved) {
    return <LoadingState label="Preparing your studio…" />;
  }

  if (phase === "welcome") {
    return (
      <WelcomeScreen
        liveAvailable={turnMode.liveAvailable}
        hasResumableSession={resume.has}
        resumeSummary={resume.summary}
        onStart={(mode) => {
          // Fresh start — discard any prior snapshot so useSession doesn't
          // restore it, then mount a clean session in the chosen mode.
          clearSession(mode);
          turnMode.setMode(mode);
          setSessionKey((k) => k + 1);
          setPhase("active");
        }}
        onResume={() => {
          // Keep the snapshot; SessionInner's useSession restores it.
          setPhase("active");
        }}
      />
    );
  }

  return (
    <SessionInner
      key={`${turnMode.mode}:${sessionKey}`}
      mode={turnMode.mode}
      liveAvailable={turnMode.liveAvailable}
      resolved={turnMode.resolved}
      autoDemoted={turnMode.autoDemoted}
      onModeChange={turnMode.setMode}
      onLiveFailure={turnMode.reportLiveFailure}
      onNewSession={() => {
        clearSession(turnMode.mode);
        setResume({ has: false });
        setPhase("welcome");
      }}
      onRetryLive={turnMode.retryLive}
      renderComponent={renderComponent}
    />
  );
}

interface SessionInnerProps {
  mode: TurnMode;
  liveAvailable: boolean;
  resolved: boolean;
  autoDemoted: { code: string } | null;
  onModeChange: (mode: TurnMode) => void;
  onLiveFailure: (code: string) => void;
  /** Discard the current session and return to the welcome screen. */
  onNewSession: () => void;
  onRetryLive: () => void;
  renderComponent?: RenderComponent;
}

function SessionInner({
  mode,
  liveAvailable,
  resolved,
  autoDemoted,
  onModeChange,
  onLiveFailure,
  onNewSession,
  onRetryLive,
  renderComponent,
}: SessionInnerProps) {
  const agent = useMemo(
    () =>
      mode === "live"
        ? new RealTurnAgent()
        : new FakeTurnAgent(new FakeAgentDriver(dogGroomerFullInterviewScript, emptyBeliefState)),
    // Deliberately empty: this instance's agent is fixed for its lifetime —
    // Session.tsx remounts SessionInner (fresh key) whenever mode changes,
    // so a new agent is always constructed by a fresh mount, never by this
    // memo re-running under a stable key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [exportOpen, setExportOpen] = useState(false);

  // `error` isn't read directly here: the chrome-styled error banner (with
  // its retry action) is rendered as a transcript entry by
  // MessageList/TranscriptRow (kind "agentError") — see useSession, which
  // appends one on every turn failure. Session only needs to keep the
  // turn-lifecycle plumbing (sendMessage/retry) wired through, plus forward
  // a live-mode failure to the mode resolver so it can auto-demote.
  const {
    beliefState,
    transcript,
    interaction,
    outgoingMessages,
    isStreaming,
    streamingText,
    error,
    completed,
    sendMessage,
    retry,
  } = useSession({ agent, storageMode: mode });

  // Stable id for this mounted session — a fresh mount is a fresh session
  // (Session.tsx remounts SessionInner with a new key on start/new-session).
  const sessionId = useMemo(() => crypto.randomUUID(), []);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  // Feed the sessions rail: record this session (upsert by id) once it has
  // settled content, then refresh the rail's list. On mount (empty
  // transcript) this just loads the existing index. Deferred via
  // queueMicrotask so the effect body makes no synchronous setState call
  // (react-hooks/set-state-in-effect) — the same pattern useSession uses for
  // its post-mount localStorage work. The index holds summaries only, never
  // belief state, so this stays clear of the single-writer invariant.
  useEffect(() => {
    queueMicrotask(() => {
      if (transcript.length > 0) {
        recordSession({
          id: sessionId,
          title: beliefState.meta.product || "Untitled session",
          subtitle: mode === "live" ? "Live session" : "Demo session",
          updatedAt: new Date().toISOString(),
          status: "active",
        });
      }
      setSessions(listSessions());
    });
  }, [beliefState, transcript.length, sessionId, mode]);

  function handleSelectSession(id: string) {
    // Selecting a *past* session can't restore its belief state yet — only
    // the latest snapshot is persisted (single-session storage). The active
    // session is already on screen; this is a visual affordance pending
    // per-session persistence, kept as an explicit extension point.
    void id;
  }

  const handleSendMessage = useCallback(
    async (message: Parameters<typeof sendMessage>[0]) => {
      await sendMessage(message);
    },
    [sendMessage],
  );

  // Forward a live-mode failure to the mode resolver so it can auto-demote
  // to demo when live mode itself looks broken (useTurnMode's
  // reportLiveFailure, gated on specific error codes there). Must be an
  // effect, not a render-body call: calling a parent's state setter while
  // this component is rendering is a React violation (triggers "Cannot
  // update a component while rendering a different component" and, worse,
  // in dev this was firing on every render while `error` stayed truthy,
  // including one observed case where it fired despite the underlying turn
  // having actually *succeeded* moments earlier — a stale-`error`-plus-
  // render-time-side-effect combination effects don't have). Depends on
  // `error` by reference so it only fires once per distinct failure, not
  // every re-render while an old error object is still in state.
  useEffect(() => {
    if (mode === "live" && error) {
      onLiveFailure(error.code);
    }
  }, [mode, error, onLiveFailure]);

  function handleRegionComment(target: string, text: string) {
    const message = normalizeRegionMessage(target, text, (ref) => lookupTokenValue(beliefState, ref));
    void handleSendMessage(message);
  }

  function handleControlMessage(target: string, text: string) {
    void handleSendMessage(normalizeControlMessage(target, text));
  }

  return (
    <div className="flex h-full w-full flex-col" data-testid="session-root">
      <StudioShell
        railSlot={
          <SessionsRail
            sessions={sessions}
            activeId={sessionId}
            onSelect={handleSelectSession}
            onNewSession={onNewSession}
          />
        }
        chatSlot={
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-app-border px-4 py-2">
              <span className="text-[11px] text-app-text-muted">
                {mode === "live"
                  ? "Live — talking to Claude"
                  : autoDemoted
                    ? "Demo — Live turned itself off after a failed turn"
                    : "Demo — scripted interview, no API key needed"}
              </span>
              <ModeToggle
                mode={mode}
                liveAvailable={liveAvailable}
                resolved={resolved}
                disabled={isStreaming}
                onChange={onModeChange}
              />
            </div>
            {autoDemoted && (
              <div
                className="flex items-center justify-between gap-2 border-b border-app-border bg-app-bg-raised px-4 py-2 text-[11px] text-app-text-secondary"
                data-testid="auto-demoted-banner"
              >
                <span>
                  Live mode failed on its first turn ({autoDemoted.code}) and switched to Demo so you&rsquo;re not
                  stuck. Fix the API key/server, then:
                </span>
                <button
                  type="button"
                  onClick={onRetryLive}
                  className="shrink-0 rounded-app-pill bg-app-bg-input px-2.5 py-1 font-medium text-app-text shadow-app-edge transition hover:text-app-accent"
                  data-testid="retry-live-button"
                >
                  Retry Live
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1">
              <ChatPanel
                transcript={transcript}
                liveInteraction={interaction}
                beliefState={beliefState}
                isStreaming={isStreaming}
                streamingText={streamingText}
                onSendMessage={(m) => void handleSendMessage(m)}
                onRetry={retry}
                renderComponent={renderComponent}
              />
            </div>
            {completed && (
              <div className="border-t border-app-border px-4 py-3" data-testid="completion-cta">
                <p className="mb-2 text-xs text-app-text-secondary">
                  This design system looks solid — export it whenever you&rsquo;re ready, or keep refining.
                </p>
                <button
                  type="button"
                  onClick={() => setExportOpen(true)}
                  className="rounded-app-pill bg-app-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-app-accent-hover"
                  data-testid="completion-export-button"
                >
                  Export design.md
                </button>
              </div>
            )}
            <DevInspectorPanel messages={outgoingMessages} />
          </div>
        }
        previewSlot={
          <PreviewPane
            beliefState={beliefState}
            disabled={isStreaming}
            completed={completed}
            onRegionComment={handleRegionComment}
            onControlMessage={handleControlMessage}
            onExport={() => setExportOpen(true)}
            renderComponent={renderComponent}
          />
        }
      />

      {exportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
          data-testid="export-modal-backdrop"
          onClick={() => setExportOpen(false)}
        >
          <div
            className="max-h-[85vh] overflow-auto rounded-app-lg shadow-app-overlay"
            onClick={(e) => e.stopPropagation()}
            data-testid="export-modal"
          >
            <ExportPanel state={beliefState} />
            <button
              type="button"
              onClick={() => setExportOpen(false)}
              className="mt-2 w-full rounded-app-md bg-app-bg-raised px-3 py-1.5 text-xs text-app-text-secondary shadow-app-edge transition hover:text-app-text"
              data-testid="export-modal-close"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
