/**
 * Renders the transcript: past user messages, past agent interactions
 * (collapsed to their question/caption text once superseded), the *current*
 * live interaction (full ask/propose card), and any error banners.
 */
"use client";

import type {
  BeliefState,
  Interaction,
  NormalizedMessage,
  ProposalVariant,
  QuickReply,
  RenderComponent,
} from "@/contracts";
import type { TranscriptEntry } from "../state/transcript";
import { TurnErrorBanner } from "../feedback/TurnErrorBanner";
import { QuickReplies } from "./QuickReplies";
import { ProposalPicker } from "./ProposalPicker";

export interface MessageListProps {
  transcript: TranscriptEntry[];
  liveInteraction: Interaction | null;
  beliefState: BeliefState;
  isStreaming: boolean;
  streamingText: string;
  disabled: boolean;
  onQuickReply: (reply: QuickReply) => void;
  onProposalPick: (variant: ProposalVariant, interaction: Interaction) => void;
  onNoneOfThese: (interaction: Interaction) => void;
  onRetry: () => void;
  renderComponent?: RenderComponent;
}

export function MessageList({
  transcript,
  liveInteraction,
  beliefState,
  isStreaming,
  streamingText,
  disabled,
  onQuickReply,
  onProposalPick,
  onNoneOfThese,
  onRetry,
  renderComponent,
}: MessageListProps) {
  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" data-testid="message-list">
      {transcript.map((entry) => (
        <TranscriptRow key={entry.id} entry={entry} onRetry={onRetry} />
      ))}

      {isStreaming && (
        <div
          className="flex max-w-[85%] items-center gap-2 rounded-app-md bg-app-bg-raised px-3 py-2 text-sm text-app-text-secondary shadow-app-card"
          data-testid="streaming-indicator"
        >
          <ThinkingDots />
          <span>{streamingText || "thinking…"}</span>
        </div>
      )}

      {!isStreaming && liveInteraction && (
        <LiveInteractionCard
          interaction={liveInteraction}
          beliefState={beliefState}
          disabled={disabled}
          onQuickReply={onQuickReply}
          onProposalPick={onProposalPick}
          onNoneOfThese={onNoneOfThese}
          renderComponent={renderComponent}
        />
      )}
    </div>
  );
}

function TranscriptRow({
  entry,
  onRetry,
}: {
  entry: TranscriptEntry;
  onRetry: () => void;
}) {
  if (entry.kind === "userMessage") {
    return (
      <div
        className="ml-auto max-w-[85%] rounded-app-md bg-app-accent px-3 py-2 text-sm text-white shadow-app-card"
        data-testid="transcript-user-message"
      >
        {messageText(entry.message)}
      </div>
    );
  }

  if (entry.kind === "agentInteraction") {
    return (
      <div
        className="max-w-[85%] rounded-app-md bg-app-bg-raised px-3 py-2 text-sm text-app-text shadow-app-card"
        data-testid="transcript-agent-interaction"
      >
        {entry.interaction.mode === "ask" ? entry.interaction.question : entry.interaction.caption}
      </div>
    );
  }

  // agentError
  return <TurnErrorBanner code={entry.code} message={entry.message} onRetry={onRetry} />;
}

function LiveInteractionCard({
  interaction,
  beliefState,
  disabled,
  onQuickReply,
  onProposalPick,
  onNoneOfThese,
  renderComponent,
}: {
  interaction: Interaction;
  beliefState: BeliefState;
  disabled: boolean;
  onQuickReply: (reply: QuickReply) => void;
  onProposalPick: (variant: ProposalVariant, interaction: Interaction) => void;
  onNoneOfThese: (interaction: Interaction) => void;
  renderComponent?: RenderComponent;
}) {
  if (interaction.mode === "ask") {
    return (
      <div className="flex flex-col gap-2" data-testid="live-interaction-ask">
        <div className="max-w-[85%] rounded-app-md bg-app-bg-raised px-3 py-2 text-sm text-app-text shadow-app-card">
          {interaction.question}
        </div>
        <QuickReplies
          quickReplies={interaction.quickReplies}
          onPick={onQuickReply}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <ProposalPicker
      state={beliefState}
      interaction={interaction}
      onPick={(variant) => onProposalPick(variant, interaction)}
      onNoneOfThese={() => onNoneOfThese(interaction)}
      disabled={disabled}
      renderComponent={renderComponent}
    />
  );
}

function messageText(message: NormalizedMessage): string {
  return message.text;
}

function ThinkingDots() {
  return (
    <span className="flex gap-0.5" aria-hidden>
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-app-text-muted" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-app-text-muted [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-app-text-muted [animation-delay:300ms]" />
    </span>
  );
}
