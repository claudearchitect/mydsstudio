/**
 * Session — the real (non-placeholder) two-pane session, wiring
 * `useSession` (turn lifecycle, belief state, transcript) into
 * `StudioShell`'s chatSlot/previewSlot, plus the dev inspector panel docked
 * under the chat column. This is what `src/app/page.tsx` mounts.
 *
 * Phase-0/V0: driven by the fake-agent TurnAgent (fixtures/fakeAgent) —
 * wiring the real `/api/turn` SSE client is Phase 2 (V0_PLAN.md). The seam
 * is the `TurnAgent` interface (turn/turnAgent.ts): swapping the real
 * client in only touches the `agent` passed here.
 */
"use client";

import { useMemo } from "react";
import type { RenderComponent } from "@/contracts";
import { FakeAgentDriver, dogGroomerFullInterviewScript } from "@fixtures/fakeAgent";
import { emptyBeliefState } from "@fixtures/beliefStates";
import { StudioShell } from "./StudioShell";
import { ChatPanel } from "./chat/ChatPanel";
import { PreviewPane } from "./preview/PreviewPane";
import { DevInspectorPanel } from "./inspector/DevInspectorPanel";
import { useSession } from "./turn/useSession";
import { FakeTurnAgent } from "./turn/fakeTurnAgent";
import {
  normalizeControlMessage,
  normalizeRegionMessage,
} from "./messages/normalize";
import { lookupTokenValue } from "./controls/tokenLookup";

export interface SessionProps {
  renderComponent?: RenderComponent;
}

export function Session({ renderComponent }: SessionProps) {
  const agent = useMemo(
    () => new FakeTurnAgent(new FakeAgentDriver(dogGroomerFullInterviewScript, emptyBeliefState)),
    [],
  );

  // `error` isn't read directly here: the chrome-styled error banner (with
  // its retry action) is rendered as a transcript entry by
  // MessageList/TranscriptRow (kind "agentError") — see useSession, which
  // appends one on every turn failure. Session only needs to keep the
  // turn-lifecycle plumbing (sendMessage/retry) wired through.
  const {
    beliefState,
    transcript,
    interaction,
    outgoingMessages,
    isStreaming,
    streamingText,
    sendMessage,
    retry,
  } = useSession({ agent });

  function handleRegionComment(target: string, text: string) {
    const message = normalizeRegionMessage(target, text, (ref) => lookupTokenValue(beliefState, ref));
    void sendMessage(message);
  }

  function handleControlMessage(target: string, text: string) {
    void sendMessage(normalizeControlMessage(target, text));
  }

  return (
    <div className="flex h-full w-full flex-col" data-testid="session-root">
      <StudioShell
        chatSlot={
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <ChatPanel
                transcript={transcript}
                liveInteraction={interaction}
                beliefState={beliefState}
                isStreaming={isStreaming}
                streamingText={streamingText}
                onSendMessage={(m) => void sendMessage(m)}
                onRetry={retry}
                renderComponent={renderComponent}
              />
            </div>
            <DevInspectorPanel messages={outgoingMessages} />
          </div>
        }
        previewSlot={
          <PreviewPane
            beliefState={beliefState}
            disabled={isStreaming}
            onRegionComment={handleRegionComment}
            onControlMessage={handleControlMessage}
            renderComponent={renderComponent}
          />
        }
      />
    </div>
  );
}
