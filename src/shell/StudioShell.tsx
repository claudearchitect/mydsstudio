/**
 * Two-pane studio shell skeleton (V0_PLAN.md "Studio shell design" /
 * Phase 0 checklist). Placeholder content only — Workstream B replaces the
 * chat column internals; Workstream A replaces the preview pane internals.
 * Layout structure and the `--app-*` chrome is what Phase 0 freezes.
 */
import type { ReactNode } from "react";

export interface StudioShellProps {
  /** Left column: conversation surface. Workstream B mounts the real chat
   * panel here (V0_PLAN.md Workstream B "Session UI shell"). */
  chatSlot?: ReactNode;
  /** Right pane: the preview card + controls bar + header. Workstream A
   * mounts the real preview panel here. */
  previewSlot?: ReactNode;
}

export function StudioShell({ chatSlot, previewSlot }: StudioShellProps) {
  return (
    <div className="flex h-dvh w-full bg-app-bg text-app-text">
      <aside
        className="flex w-[420px] shrink-0 flex-col border-r border-app-border bg-app-bg-deep"
        data-shell="chat-column"
      >
        {chatSlot ?? <ChatColumnPlaceholder />}
      </aside>

      <main
        className="flex min-w-0 flex-1 flex-col bg-app-bg"
        data-shell="preview-pane"
      >
        {previewSlot ?? <PreviewPanePlaceholder />}
      </main>
    </div>
  );
}

function ChatColumnPlaceholder() {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-app-border px-4 py-3">
        <p className="text-sm font-medium text-app-text">mydsstudio</p>
        <p className="text-xs text-app-text-muted">
          interview session — placeholder chrome
        </p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <div className="max-w-[85%] rounded-app-md border border-app-border bg-app-bg-raised px-3 py-2 text-sm text-app-text">
          What are you building, and who&apos;s it for?
        </div>
      </div>

      <div className="border-t border-app-border p-3">
        <div className="flex items-center gap-2 rounded-app-md border border-app-border bg-app-bg-input px-3 py-2">
          <span className="text-sm text-app-text-muted">
            Message input — Workstream B
          </span>
        </div>
      </div>
    </div>
  );
}

function PreviewPanePlaceholder() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-app-border px-6 py-3">
        <div>
          <p className="text-sm font-medium text-app-text">Untitled session</p>
          <p className="text-xs text-app-text-muted">design system preview</p>
        </div>
        <button
          type="button"
          disabled
          className="rounded-app-pill bg-app-accent px-4 py-1.5 text-sm font-medium text-app-text opacity-60"
        >
          Export
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center p-8">
        {/* ds-preview-root is the belief-state render boundary (see
         * globals.css): everything inside it styles itself from `--ds-*`
         * custom properties only, never from the `--app-*` shell classes
         * used elsewhere on this page. The placeholder text below uses
         * inline styles, not Tailwind/`--app-*` utilities, to keep that
         * boundary honest even as a placeholder. */}
        <div className="ds-preview-root flex h-full w-full items-center justify-center rounded-app-lg border border-app-border">
          <p style={{ fontSize: 13, color: "#8a887d" }}>
            preview panel — Workstream A renders here
          </p>
        </div>
      </div>

      <div className="border-t border-app-border px-6 py-3">
        <p className="text-xs text-app-text-muted">
          controls bar — Workstream B
        </p>
      </div>
    </div>
  );
}
