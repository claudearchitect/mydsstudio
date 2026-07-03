/**
 * PreviewPane — the right pane (V0_PLAN.md "Studio shell design" layout:
 * paper card + docked controls bar + header with title & Export button).
 * Renders the manifest's component library through `renderComponent`
 * inside the region-select overlay, and the controls bar underneath.
 *
 * Defaults to Workstream A's real renderer (`@/preview`'s `renderComponent`,
 * with reveal states) rather than the Phase-0 gray-box placeholder — Phase 2
 * "Mount A's real preview into B's Session preview slot ... replacing the
 * placeholder path". Callers (tests, dev harnesses) can still override via
 * the `renderComponent` prop, e.g. to exercise the placeholder explicitly.
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

import { useState, type CSSProperties } from "react";
import { COMPONENT_MANIFEST, resolveTokens, type BeliefState, type RenderComponent } from "@/contracts";
import { renderComponent as realRenderComponent } from "@/preview/renderComponent";
import { lookupTokenValue } from "../controls/tokenLookup";
import { withPendingPreview, type PendingPreviewEntry } from "../controls/pendingPreview";
import { RegionSelectOverlay } from "../region/RegionSelectOverlay";
import { ControlsBar } from "../controls/ControlsBar";
import { rationaleClaimsFor } from "./rationaleLookup";

export interface PreviewPaneProps {
  beliefState: BeliefState;
  disabled?: boolean;
  onRegionComment: (target: string, text: string) => void;
  onControlMessage: (target: string, text: string) => void;
  onExport?: () => void;
  renderComponent?: RenderComponent;
  /** True when the agent has signaled confident completion this turn
   * (Phase 2 "Completion state") — shows a small badge next to the header
   * title so it's visible even if the chat-panel CTA has scrolled away. */
  completed?: boolean;
}

export function PreviewPane({
  beliefState,
  disabled,
  onRegionComment,
  onControlMessage,
  onExport,
  renderComponent = realRenderComponent,
  completed,
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
        <div className="flex items-center gap-2">
          <div>
            <p className="text-sm font-medium text-app-text">
              {beliefState.meta.product || "Untitled session"}
            </p>
            <p className="text-xs text-app-text-muted">design system preview</p>
          </div>
          {completed && (
            <span
              className="rounded-app-pill px-2 py-0.5 text-[11px] font-medium text-app-positive shadow-[0_0_0_1px_var(--app-positive)]"
              data-testid="completion-badge"
            >
              Ready to export
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={!onExport}
          className="rounded-app-pill bg-app-accent px-4 py-1.5 text-sm font-medium text-white transition hover:bg-app-accent-hover disabled:opacity-60 disabled:hover:bg-app-accent"
          data-testid="export-button"
        >
          Export
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center overflow-auto p-8">
        <div
          className="ds-preview-root h-full w-full rounded-app-lg p-6 shadow-app-paper"
          data-testid="ds-preview-root"
          style={resolveTokens(displayState) as CSSProperties}
        >
          <RegionSelectOverlay
            resolve={resolve}
            onSubmitComment={onRegionComment}
            disabled={disabled}
            rationaleFor={(componentId) => rationaleClaimsFor(beliefState, componentId)}
          >
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
