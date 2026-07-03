/**
 * Free-text chat input. Always available regardless of interaction mode —
 * the "something else" escape for quick-replies and proposals alike
 * (IMPLEMENTATION.md #3: "every question includes a 'something else'
 * escape"). Submission disabled while a turn is streaming (turn-lifecycle
 * invariant: one in-flight turn at a time, V0_PLAN.md Workstream B).
 */
"use client";

import { useState, type FormEvent } from "react";

export interface ChatInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSubmit, disabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 rounded-app-md border border-app-border bg-app-bg-input px-3 py-2 focus-within:border-app-link"
      data-testid="chat-input-form"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        placeholder={placeholder ?? "Type a message…"}
        className="min-w-0 flex-1 bg-transparent text-sm text-app-text placeholder:text-app-text-muted focus:outline-none disabled:opacity-50"
        data-testid="chat-input-field"
      />
      <button
        type="submit"
        disabled={disabled || value.trim().length === 0}
        className="rounded-app-pill bg-app-accent px-3 py-1 text-xs font-medium text-app-text disabled:opacity-40"
        data-testid="chat-input-submit"
      >
        Send
      </button>
    </form>
  );
}
