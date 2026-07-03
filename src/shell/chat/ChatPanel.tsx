/**
 * ChatPanel — the left-column conversation surface (V0_PLAN.md Workstream B
 * "Chat panel" + "Session UI shell" left column). Composes the message
 * list, the live ask/propose interaction, quick replies, the proposal
 * picker, and the always-present free-text input.
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
import { normalizeChatMessage } from "../messages/normalize";
import type { TranscriptEntry } from "../state/transcript";
import { StudioLogo } from "../Logo";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

export interface ChatPanelProps {
  transcript: TranscriptEntry[];
  liveInteraction: Interaction | null;
  beliefState: BeliefState;
  isStreaming: boolean;
  streamingText: string;
  onSendMessage: (message: NormalizedMessage) => void;
  onRetry: () => void;
  renderComponent?: RenderComponent;
}

export function ChatPanel({
  transcript,
  liveInteraction,
  beliefState,
  isStreaming,
  streamingText,
  onSendMessage,
  onRetry,
  renderComponent,
}: ChatPanelProps) {
  function handleFreeText(text: string) {
    onSendMessage(normalizeChatMessage(text));
  }

  function handleQuickReply(reply: QuickReply) {
    onSendMessage(normalizeChatMessage(reply.label));
  }

  function handleProposalPick(variant: ProposalVariant, interaction: Interaction) {
    if (interaction.mode !== "propose") return;
    onSendMessage(
      normalizeChatMessage(
        `user picked "${variant.caption}" for the ${interaction.axis.join(", ")} proposal on ${interaction.target}`,
      ),
    );
  }

  function handleNoneOfThese(interaction: Interaction) {
    if (interaction.mode !== "propose") return;
    onSendMessage(
      normalizeChatMessage(
        `none of these feel right for ${interaction.axis.join(", ")} — user wants different options`,
      ),
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="chat-panel">
      <header className="flex items-center gap-2.5 border-b border-app-border px-4 py-3">
        <StudioLogo />
        <div>
          <p className="text-sm font-semibold tracking-tight text-app-text">MyDS Studio</p>
          <p className="text-xs text-app-text-muted">interview session</p>
        </div>
      </header>

      <MessageList
        transcript={transcript}
        liveInteraction={liveInteraction}
        beliefState={beliefState}
        isStreaming={isStreaming}
        streamingText={streamingText}
        disabled={isStreaming}
        onQuickReply={handleQuickReply}
        onProposalPick={handleProposalPick}
        onNoneOfThese={handleNoneOfThese}
        onRetry={onRetry}
        renderComponent={renderComponent}
      />

      <div className="border-t border-app-border p-3">
        <ChatInput
          onSubmit={handleFreeText}
          disabled={isStreaming}
          placeholder={isStreaming ? "Waiting for response…" : "Type a message… (always available)"}
        />
      </div>
    </div>
  );
}
