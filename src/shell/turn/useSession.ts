/**
 * useSession — the shell's central orchestrator. Owns:
 *  - the current BeliefState (read-only outside of applying an agent's
 *    patch — single-writer invariant: only `applyPatch`, called here with
 *    the agent's own patch/eventId, ever changes it)
 *  - the transcript (UI history)
 *  - turn lifecycle (one in-flight turn at a time, streaming deltas, error
 *    banner + retry)
 *  - localStorage snapshot/restore
 *  - the outgoing normalized-message log for the dev inspector
 *
 * This hook does NOT build NormalizedMessages itself — callers (chat input,
 * region popover, controls) construct them via src/shell/messages/normalize
 * and hand them to `sendMessage`. This keeps "how a channel phrases itself"
 * separate from "how a turn is dispatched and applied".
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BeliefState, Interaction, NormalizedMessage } from "@/contracts";
import { emptyBeliefState } from "@fixtures/beliefStates";
import type { TurnAgent, TurnAgentResult } from "./turnAgent";
import {
  nextTranscriptId,
  type TranscriptEntry,
} from "../state/transcript";
import { restoreSession, saveSession } from "../state/sessionStorage";

export interface UseSessionOptions {
  agent: TurnAgent;
  /** Skip the localStorage restore attempt (useful in tests). */
  disablePersistence?: boolean;
  /** Automatically play the agent's kickoff turn on mount if there's no
   * restored session and no interaction yet. */
  autoKickoff?: boolean;
}

export interface UseSessionResult {
  beliefState: BeliefState;
  transcript: TranscriptEntry[];
  interaction: Interaction | null;
  /** Outgoing NormalizedMessages this session has sent, most-recent-last —
   * feeds the dev inspector panel. */
  outgoingMessages: NormalizedMessage[];
  isStreaming: boolean;
  streamingText: string;
  error: { code: string; message: string } | null;
  sendMessage: (message: NormalizedMessage) => Promise<void>;
  retry: () => void;
  agentExhausted: boolean;
  /** True once the agent has signaled confident completion (V0_PLAN.md
   * Phase 2 "Completion state") — drives the Export CTA. Reset to false on
   * every new turn until that turn's result says otherwise, so it always
   * reflects the *latest* turn, not "ever completed this session". */
  completed: boolean;
}

export function useSession({
  agent,
  disablePersistence,
  autoKickoff = true,
}: UseSessionOptions): UseSessionResult {
  // Always initialize to the empty/SSR-safe state, matching what the server
  // renders (localStorage doesn't exist server-side) — restoring a real
  // snapshot happens in the effect below, strictly after mount. Seeding
  // this initializer from localStorage directly would make the client's
  // first render diverge from the server-rendered HTML and trigger a
  // hydration mismatch (React re-does the whole tree client-side to
  // recover, which is correct but noisy and defeats SSR).
  const [beliefState, setBeliefState] = useState<BeliefState>(emptyBeliefState);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [outgoingMessages, setOutgoingMessages] = useState<NormalizedMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [completed, setCompleted] = useState(false);

  const lastMessageRef = useRef<NormalizedMessage | null>(null);
  const kickedOffRef = useRef(false);

  const runTurn = useCallback(
    async (message: NormalizedMessage | null) => {
      setIsStreaming(true);
      setStreamingText("");
      setError(null);
      lastMessageRef.current = message;
      // Not resetting `completed` here: a mid-flight turn (e.g. the user
      // sends one more nudge after completion) should keep showing the
      // Export CTA until the *new* turn's result says otherwise — flipping
      // it off during the in-flight window would flash the CTA away and
      // back for no reason. `completed` is set from `result.completed` once
      // the turn settles, whatever that turns out to be.

      let result: TurnAgentResult;
      try {
        result = await agent.runTurn(message, beliefState, {
          onDelta: (chunk) => setStreamingText((prev) => prev + chunk),
        });
      } catch (err) {
        result = {
          kind: "error",
          code: "unknown",
          message: err instanceof Error ? err.message : String(err),
        };
      }

      setIsStreaming(false);

      if (result.kind === "error") {
        setError({ code: result.code, message: result.message });
        setTranscript((prev) => [
          ...prev,
          {
            kind: "agentError",
            id: nextTranscriptId("err"),
            code: result.code,
            message: result.message,
            ts: new Date().toISOString(),
          },
        ]);
        return;
      }

      setBeliefState(result.beliefState);
      setInteraction(result.interaction);
      setCompleted(Boolean(result.completed));
      setTranscript((prev) => [
        ...prev,
        {
          kind: "agentInteraction",
          id: nextTranscriptId("turn"),
          interaction: result.interaction,
          deltaText: streamingText || undefined,
          ts: new Date().toISOString(),
          completed: result.completed,
        },
      ]);
    },
    // streamingText intentionally excluded: reading it inside the async
    // closure would race with setStreamingText from onDelta; the transcript
    // entry's deltaText is best-effort and not load-bearing for the gate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agent, beliefState],
  );

  const sendMessage = useCallback(
    async (message: NormalizedMessage) => {
      if (isStreaming) return; // one in-flight turn at a time
      setOutgoingMessages((prev) => [...prev, message]);
      setTranscript((prev) => [
        ...prev,
        {
          kind: "userMessage",
          id: nextTranscriptId("msg"),
          message,
          ts: new Date().toISOString(),
        },
      ]);
      await runTurn(message);
    },
    [isStreaming, runTurn],
  );

  const retry = useCallback(() => {
    if (isStreaming) return;
    void runTurn(lastMessageRef.current);
  }, [isStreaming, runTurn]);

  // Post-mount localStorage restore (see the state-init comment above for
  // why this can't happen in the useState initializer). Runs once; a
  // restored transcript/belief state is only applied if there actually was
  // one to restore — otherwise this just flips `restoredFromStorage` so the
  // kickoff effect below knows it's safe to proceed with a fresh session.
  // Deferred via queueMicrotask for the same react-hooks/set-state-in-effect
  // reason as the kickoff effect below — this keeps the effect body itself
  // free of direct setState calls while still resolving before paint.
  useEffect(() => {
    queueMicrotask(() => {
      if (disablePersistence) {
        setRestoredFromStorage(true);
        return;
      }
      const restored = restoreSession();
      if (restored) {
        setBeliefState(restored.beliefState);
        setTranscript(restored.transcript);
        // A restored session already has its own history — never replay
        // the scripted kickoff turn on top of it.
        kickedOffRef.current = true;
      }
      setRestoredFromStorage(true);
    });
  }, [disablePersistence]);

  // Kickoff turn: a fresh session (no interaction yet, nothing restored)
  // asks the opening question with no user message (IMPLEMENTATION.md #3 /
  // V0_PLAN.md Workstream C "Kickoff turn"). Guarded so it fires once, and
  // only after the restore attempt above has resolved (so a
  // to-be-restored session never gets a duplicate scripted kickoff turn
  // played on top of it). `runTurn` sets state synchronously at its start
  // (setIsStreaming(true)); queueing it as a microtask keeps this effect's
  // own body free of direct setState calls (react-hooks/set-state-in-effect)
  // while still starting the kickoff turn right after mount.
  useEffect(() => {
    if (!autoKickoff) return;
    if (!restoredFromStorage) return;
    if (kickedOffRef.current) return;
    if (interaction !== null) return;
    if (isStreaming) return;
    kickedOffRef.current = true;
    queueMicrotask(() => void runTurn(null));
    // runTurn/interaction/isStreaming intentionally excluded below: this
    // effect must fire once on mount (after restore resolves), not re-run
    // whenever a turn changes `interaction`/`isStreaming` (read here only
    // as guards); `kickedOffRef` is the actual one-shot guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKickoff, restoredFromStorage]);

  // Persist on every settled change.
  useEffect(() => {
    if (disablePersistence) return;
    saveSession(beliefState, transcript);
  }, [beliefState, transcript, disablePersistence]);

  return {
    beliefState,
    transcript,
    interaction,
    outgoingMessages,
    isStreaming,
    streamingText,
    error,
    sendMessage,
    retry,
    agentExhausted: agent.exhausted,
    completed,
  };
}
