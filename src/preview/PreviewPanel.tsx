/**
 * PreviewPanel — renders the whole exemplar library from a given belief
 * state, with reveal states applied (V0_PLAN.md Workstream A: "Preview
 * panel"). Mounts inside the shell's `.ds-preview-root` boundary (see
 * src/app/globals.css) — everything under this component reads only
 * `--ds-*` vars, resolved here via `resolveTokens` and written as inline
 * CSS custom properties on the root node so the whole subtree inherits
 * them.
 *
 * This component owns no state of its own beyond what's passed in — the
 * belief state is a prop, per IMPLEMENTATION.md #1 ("the renderer never
 * holds state").
 */
"use client";

import type { CSSProperties } from "react";
import type { BeliefState } from "@/contracts";
import { resolveTokens, COMPONENT_MANIFEST } from "@/contracts";
import { renderComponent } from "./renderComponent";

export interface PreviewPanelProps {
  state: BeliefState;
  /** Optional: render only a subset of the manifest (e.g. proposal
   * pickers rendering a single target component). Defaults to the full
   * library. */
  componentIds?: string[];
}

export function PreviewPanel({ state, componentIds }: PreviewPanelProps) {
  const resolved = resolveTokens(state);
  const ids = componentIds ?? COMPONENT_MANIFEST.map((e) => e.componentId);

  return (
    <div
      className="ds-preview-root"
      data-testid="preview-panel"
      style={resolved as CSSProperties}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: 24,
          padding: 24,
          fontFamily:
            'ui-sans-serif, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        {ids.map((id) => (
          <div
            key={id}
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            {renderComponent(state, id)}
          </div>
        ))}
      </div>
    </div>
  );
}
