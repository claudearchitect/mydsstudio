/**
 * Region-select overlay (IMPLEMENTATION.md #4 "Region select"). Wraps the
 * preview subtree, listens for hover/click on any `data-component`
 * element (set by `renderComponent`, contracts/renderComponent.tsx), draws
 * a hover outline, and opens a chrome-styled popover on click with a text
 * input bound to that component.
 *
 * Resolution is deterministic: `tokensInScopeFor` (component manifest) is
 * the *only* thing that decides which tokens are "in scope" for a region
 * comment — no vision model, no guessing.
 *
 * Rationale surfacing (V0_PLAN.md Phase 2, "A + C": "tap/hover a preview
 * component -> rationale claims for its token groups") piggybacks on the
 * same hover tracking this overlay already does for the click-to-comment
 * affordance — `rationaleFor` is an optional lookup the caller provides;
 * when it returns claims for the hovered component, a small chrome-styled
 * tooltip renders alongside the existing hover outline. Purely additive:
 * omitting the prop reproduces the exact previous behavior.
 */
"use client";

import { useCallback, useState, type ReactNode } from "react";
import { getManifestEntry } from "@/contracts";
import { RegionCommentPopover } from "./RegionCommentPopover";

export interface RegionSelectOverlayProps {
  children: ReactNode;
  resolve: (dottedRef: string) => string | number | undefined;
  onSubmitComment: (target: string, text: string) => void;
  disabled?: boolean;
  /** Returns the rationale claim strings that justify a component's current
   * rendering, keyed by componentId. Empty/absent means "nothing to show"
   * (e.g. no belief has touched this component's tokens yet). */
  rationaleFor?: (componentId: string) => string[];
}

/** Anchor rect already made relative to the container (computed inside the
 * event handler, from `e.currentTarget`, never read from a ref during
 * render — react-hooks/refs forbids that). */
interface RelativeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface HoverTarget {
  componentId: string;
  rect: RelativeRect;
}

interface SelectedTarget {
  componentId: string;
  rect: RelativeRect;
}

function toRelativeRect(el: HTMLElement, container: HTMLElement): RelativeRect {
  const elRect = el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  return {
    left: elRect.left - containerRect.left,
    top: elRect.top - containerRect.top,
    width: elRect.width,
    height: elRect.height,
  };
}

export function RegionSelectOverlay({
  children,
  resolve,
  onSubmitComment,
  disabled,
  rationaleFor,
}: RegionSelectOverlayProps) {
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const [selected, setSelected] = useState<SelectedTarget | null>(null);

  const findComponentEl = useCallback((target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof Element)) return null;
    return target.closest<HTMLElement>("[data-component]");
  }, []);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (disabled) return;
    const el = findComponentEl(e.target);
    if (!el) {
      setHover(null);
      return;
    }
    const componentId = el.dataset.component!;
    if (!getManifestEntry(componentId)) {
      setHover(null);
      return;
    }
    setHover({ componentId, rect: toRelativeRect(el, e.currentTarget) });
  }

  function handleMouseLeave() {
    setHover(null);
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (disabled) return;
    const el = findComponentEl(e.target);
    if (!el) return;
    const componentId = el.dataset.component!;
    if (!getManifestEntry(componentId)) return;
    setSelected({ componentId, rect: toRelativeRect(el, e.currentTarget) });
    setHover(null);
  }

  return (
    <div
      className="relative h-full w-full"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      data-testid="region-select-overlay"
    >
      {children}

      {hover && !selected && (
        <div
          className="pointer-events-none absolute rounded-app-sm border-2 border-app-link"
          style={{
            left: hover.rect.left,
            top: hover.rect.top,
            width: hover.rect.width,
            height: hover.rect.height,
          }}
          data-testid="region-hover-outline"
          data-hover-target={hover.componentId}
        />
      )}

      {hover && !selected && rationaleFor && (
        <RationaleTooltip componentId={hover.componentId} rect={hover.rect} claims={rationaleFor(hover.componentId)} />
      )}

      {selected && (
        <RegionCommentPopover
          componentId={selected.componentId}
          anchorRect={selected.rect}
          resolve={resolve}
          onSubmit={(text) => {
            onSubmitComment(selected.componentId, text);
            setSelected(null);
          }}
          onDismiss={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/** Small chrome-styled tooltip surfacing the rationale claim(s) behind a
 * hovered component's current rendering (V0_PLAN.md Phase 2 "Rationale
 * surfacing"). Renders nothing when there are no claims yet — an untouched
 * or low-confidence component simply has no "why" to show. */
function RationaleTooltip({
  componentId,
  rect,
  claims,
}: {
  componentId: string;
  rect: RelativeRect;
  claims: string[];
}) {
  if (claims.length === 0) return null;
  return (
    <div
      className="pointer-events-none absolute z-20 max-w-xs rounded-app-sm border border-app-border bg-app-bg-raised px-2.5 py-2 text-xs text-app-text shadow-lg"
      style={{ left: rect.left, top: Math.max(0, rect.top - 8 - claims.length * 18 - 8) }}
      data-testid="rationale-tooltip"
      data-rationale-target={componentId}
    >
      <ul className="space-y-1">
        {claims.map((claim, i) => (
          <li key={i} className="text-app-text-secondary">
            {claim}
          </li>
        ))}
      </ul>
    </div>
  );
}
