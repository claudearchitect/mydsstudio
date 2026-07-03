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
