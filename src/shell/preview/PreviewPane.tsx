/**
 * PreviewPane — the right pane (V0_PLAN.md "Studio shell design" layout:
 * paper card + docked controls bar + header with title & Export button).
 * Renders the manifest's component library through `renderComponent`
 * (Phase-0 placeholder by default; Workstream A's real implementation is a
 * drop-in swap, same signature) inside the region-select overlay, and the
 * controls bar underneath.
 *
 * Pending-preview values (from ControlsBar) are applied client-side only
 * for this render — never fed into applyPatch — and discarded whenever the
 * real beliefState changes. Reset happens inline during render (React's
 * "adjust state while rendering" pattern, not a setState-in-effect, which
 * the react-hooks/set-state-in-effect rule flags as cascading-render-prone)
 * by comparing against the last-seen beliefState reference: the moment a
 * new one shows up — the model's own patch has landed — `pending` is
 * cleared in the same render pass, before paint.
 */
"use client";

import { useState } from "react";
import {
  COMPONENT_MANIFEST,
  renderComponentPlaceholder,
  type BeliefState,
  type RenderComponent,
} from "@/contracts";
import { lookupTokenValue } from "../controls/tokenLookup";
import { withPendingPreview, type PendingPreviewEntry } from "../controls/pendingPreview";
import { RegionSelectOverlay } from "../region/RegionSelectOverlay";
import { ControlsBar } from "../controls/ControlsBar";

export interface PreviewPaneProps {
  beliefState: BeliefState;
  disabled?: boolean;
  onRegionComment: (target: string, text: string) => void;
  onControlMessage: (target: string, text: string) => void;
  onExport?: () => void;
  renderComponent?: RenderComponent;
}

export function PreviewPane({
  beliefState,
  disabled,
  onRegionComment,
  onControlMessage,
  onExport,
  renderComponent = renderComponentPlaceholder,
}: PreviewPaneProps) {
  const [pending, setPending] = useState<PendingPreviewEntry[]>([]);
  const [lastSeenBeliefState, setLastSeenBeliefState] = useState(beliefState);

  // Discard pending previews the moment a new (real) belief state arrives —
  // IMPLEMENTATION.md #4: "the canvas settles to *the model's* truth ...
  // discarded when the next belief state arrives". Done inline during
  // render (not in an effect) so there's no extra commit/flash of stale
  // pending values before the reset takes effect.
  if (beliefState !== lastSeenBeliefState) {
    setLastSeenBeliefState(beliefState);
    setPending([]);
  }

  const displayState = withPendingPreview(beliefState, pending);

  function handlePendingChange(dottedRef: string, $value: string | number, $type: "color" | "dimension") {
    setPending((prev) => [...prev.filter((p) => p.dottedRef !== dottedRef), { dottedRef, $value, $type }]);
  }

  function resolve(dottedRef: string): string | number | undefined {
    return lookupTokenValue(displayState, dottedRef);
  }

  return (
    <div className="flex h-full flex-col" data-testid="preview-pane">
      <header className="flex items-center justify-between border-b border-app-border px-6 py-3">
        <div>
          <p className="text-sm font-medium text-app-text">
            {beliefState.meta.product || "Untitled session"}
          </p>
          <p className="text-xs text-app-text-muted">design system preview</p>
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={!onExport}
          className="rounded-app-pill bg-app-accent px-4 py-1.5 text-sm font-medium text-app-text disabled:opacity-60"
          data-testid="export-button"
        >
          Export
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center overflow-auto p-8">
        <div
          className="ds-preview-root h-full w-full rounded-app-lg border border-app-border p-6"
          data-testid="ds-preview-root"
        >
          <RegionSelectOverlay resolve={resolve} onSubmitComment={onRegionComment} disabled={disabled}>
            <div className="flex flex-wrap items-start gap-4" data-testid="component-grid">
              {COMPONENT_MANIFEST.map((entry) => (
                <div key={entry.componentId} data-testid={`component-slot-${entry.componentId}`}>
                  {renderComponent(displayState, entry.componentId)}
                </div>
              ))}
            </div>
          </RegionSelectOverlay>
        </div>
      </div>

      <div className="border-t border-app-border px-6 py-3">
        <ControlsBar
          beliefState={displayState}
          disabled={disabled}
          onPendingChange={handlePendingChange}
          onSendMessage={onControlMessage}
        />
      </div>
    </div>
  );
}
