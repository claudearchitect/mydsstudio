/**
 * Quick-reply chips for an `ask` interaction. A shortcut, never the only
 * path (interaction.ts: "chips are a shortcut, never the only path") — the
 * ChatInput free-text field sits alongside these at all times.
 */
"use client";

import type { QuickReply } from "@/contracts";

export interface QuickRepliesProps {
  quickReplies: QuickReply[];
  onPick: (reply: QuickReply) => void;
  disabled?: boolean;
}

export function QuickReplies({ quickReplies, onPick, disabled }: QuickRepliesProps) {
  if (quickReplies.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2" data-testid="quick-replies">
      {quickReplies.map((reply) => (
        <button
          key={reply.id}
          type="button"
          disabled={disabled}
          onClick={() => onPick(reply)}
          className="rounded-app-pill border border-app-border bg-app-bg-raised px-3 py-1.5 text-xs text-app-text hover:border-app-link disabled:opacity-40"
          data-testid={`quick-reply-${reply.id}`}
        >
          {reply.label}
        </button>
      ))}
    </div>
  );
}
