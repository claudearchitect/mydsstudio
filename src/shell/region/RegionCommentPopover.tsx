/**
 * Region comment popover — chrome-styled (`--app-bg-raised`, per V0_PLAN.md
 * "Studio shell design": "the comment popover is chrome-styled"), text
 * input bound to the clicked component. Displays the resolved
 * tokens-in-scope so the user can see exactly what a comment here would
 * apply to (transparency into the deterministic manifest lookup).
 */
"use client";

import { useState, type FormEvent } from "react";
import { getManifestEntry, tokensInScopeFor } from "@/contracts";

export interface RegionCommentPopoverProps {
  componentId: string;
  anchorRect: { left: number; top: number; width: number; height: number };
  resolve: (dottedRef: string) => string | number | undefined;
  onSubmit: (text: string) => void;
  onDismiss: () => void;
}

export function RegionCommentPopover({
  componentId,
  anchorRect,
  resolve,
  onSubmit,
  onDismiss,
}: RegionCommentPopoverProps) {
  const [text, setText] = useState("");
  const entry = getManifestEntry(componentId);
  const tokensInScope = tokensInScopeFor(componentId, resolve);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <div
      className="absolute z-10 w-72 rounded-app-md border border-app-border bg-app-bg-raised p-3 shadow-lg"
      style={{ left: anchorRect.left, top: anchorRect.top + anchorRect.height + 8 }}
      data-testid="region-comment-popover"
      data-target={componentId}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-app-text">{entry?.label ?? componentId}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-app-text-muted hover:text-app-text"
          data-testid="region-popover-dismiss"
        >
          ✕
        </button>
      </div>

      <ul className="mb-2 space-y-0.5" data-testid="region-tokens-in-scope">
        {Object.entries(tokensInScope).map(([ref, value]) => (
          <li key={ref} className="text-xs text-app-text-muted" data-token-ref={ref}>
            {ref}: <span className="text-app-text-secondary">{String(value)}</span>
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="text"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What feels off here?"
          className="rounded-app-sm border border-app-border bg-app-bg-input px-2 py-1.5 text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:border-app-link"
          data-testid="region-comment-input"
        />
        <button
          type="submit"
          disabled={text.trim().length === 0}
          className="self-end rounded-app-pill bg-app-accent px-3 py-1 text-xs font-medium text-app-text disabled:opacity-40"
          data-testid="region-comment-submit"
        >
          Send
        </button>
      </form>
    </div>
  );
}
