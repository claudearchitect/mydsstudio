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

export interface SessionProps {
  renderComponent?: RenderComponent;
}

export function Session({ renderComponent }: SessionProps) {
  const turnMode = useTurnMode();

  // SessionInner is keyed by the *resolved* mode itself, not a separately
  // tracked counter: every distinct mode value gets its own mount (and
  // therefore its own freshly constructed agent — see SessionInner's
  // `agent` useMemo). This is deliberately simple to avoid a class of bugs
  // where a provisional first render (mode defaults to "demo" while the
  // health probe is in flight — see useTurnMode) constructs a
  // FakeTurnAgent-backed SessionInner, the probe then resolves to "live",
  // and — unless that resolution *also* forces a remount — the existing
  // instance is left driving the wrong agent underneath an updated toggle
  // label. Not rendering SessionInner at all until the probe resolves
  // sidesteps the provisional-mount case entirely; the toggle keys any
  // later explicit switch the same way, so both paths are one mechanism.
  if (!turnMode.resolved) {
    return <SessionLoading />;
  }

  return (
    <SessionInner
      key={turnMode.mode}
      mode={turnMode.mode}
      liveAvailable={turnMode.liveAvailable}
      resolved={turnMode.resolved}
      onModeChange={turnMode.setMode}
      onLiveFailure={turnMode.reportLiveFailure}
      renderComponent={renderComponent}
    />
  );
}

function SessionLoading() {
  return (
    <div
      className="flex h-dvh w-full items-center justify-center bg-app-bg text-sm text-app-text-muted"
      data-testid="session-loading"
    >
      Loading…
    </div>
  );
}

interface SessionInnerProps {
  mode: TurnMode;
  liveAvailable: boolean;
  resolved: boolean;
  onModeChange: (mode: TurnMode) => void;
  onLiveFailure: (code: string) => void;
  renderComponent?: RenderComponent;
}

function SessionInner({
  mode,
  liveAvailable,
  resolved,
  onModeChange,
  onLiveFailure,
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
  } = useSession({ agent });

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
        chatSlot={
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-app-border px-4 py-2">
              <span className="text-[11px] text-app-text-muted">
                {mode === "live" ? "Live — talking to Claude" : "Demo — scripted interview, no API key needed"}
              </span>
              <ModeToggle
                mode={mode}
                liveAvailable={liveAvailable}
                resolved={resolved}
                disabled={isStreaming}
                onChange={onModeChange}
              />
            </div>
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
