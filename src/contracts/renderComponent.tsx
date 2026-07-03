/**
 * renderComponent — the interface Workstream A's real renderer implements
 * and Workstream B builds against in the meantime (V0_PLAN.md Phase 0 /
 * Workstream A & B). Same signature both before and after A replaces the
 * body — a drop-in swap, no caller changes.
 *
 * Placeholder implementation: gray boxes, sized/labeled by componentId, no
 * confidence-driven reveal logic (that's Workstream A's job — see
 * IMPLEMENTATION.md #5 "Reveal states").
 */
import type { ReactNode } from "react";
import type { BeliefState } from "./beliefState";
import { getManifestEntry } from "./componentManifest";

export type RenderComponent = (
  state: BeliefState,
  componentId: string,
) => ReactNode;

/**
 * Phase-0 placeholder. Renders a neutral gray box with the componentId as a
 * label so B can lay out surfaces without waiting on A's real components.
 * `data-component` is set here because B's region-select overlay
 * (IMPLEMENTATION.md #4) hooks hover/click on that attribute — freezing it
 * now means A's real implementation must preserve it too.
 */
export const renderComponentPlaceholder: RenderComponent = (
  _state,
  componentId,
) => {
  const entry = getManifestEntry(componentId);
  return (
    <div
      data-component={componentId}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 48,
        minWidth: 96,
        padding: "8px 16px",
        background: "#d9d9d4",
        color: "#6b6a64",
        border: "1px dashed #a8a69c",
        borderRadius: 6,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: 13,
      }}
    >
      {entry?.label ?? componentId}
    </div>
  );
};
