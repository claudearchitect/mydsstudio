/**
 * renderComponent — Workstream A's real implementation, drop-in for the
 * Phase-0 placeholder (`renderComponentPlaceholder` in
 * src/contracts/renderComponent.tsx). Same signature:
 * `(state: BeliefState, componentId: string) => ReactNode`.
 *
 * Wraps the exemplar component (src/preview/components/) in a reveal-state
 * shell: derives absent/blurred/sharp from the belief state via
 * deriveRevealState, and applies the corresponding CSS filter/opacity
 * (IMPLEMENTATION.md #5). `data-component` is preserved on the outer node
 * because Workstream B's region-select overlay hooks hover/click on that
 * attribute (frozen in the Phase-0 placeholder's doc comment) — moving it
 * or dropping it breaks region-select.
 *
 * `data-reveal` is added (not part of the frozen contract, purely additive)
 * so dev tooling / tests can assert reveal state without recomputing it.
 */
import type { RenderComponent } from "@/contracts";
import { getManifestEntry } from "@/contracts";
import {
  REVEAL_CONFIG,
  deriveRevealState,
  componentConfidence,
  blurPxForConfidence,
  opacityForConfidence,
} from "./revealState";
import { COMPONENT_REGISTRY } from "./components";

/** Transition applied to every reveal-affecting CSS property so a belief
 * patch animates the canvas into focus instead of snapping (V0_PLAN.md
 * Workstream A: "smooth CSS transitions on state change"; IMPLEMENTATION.md
 * #7: "animate belief patches into the canvas as they arrive"). Kept as a
 * single constant so every component's transition stays in lockstep. */
export const REVEAL_TRANSITION = "filter 320ms ease, opacity 320ms ease";

export const renderComponent: RenderComponent = (state, componentId) => {
  const Entry = COMPONENT_REGISTRY[componentId];
  const manifestEntry = getManifestEntry(componentId);
  const label = manifestEntry?.label ?? componentId;

  if (!Entry) {
    // Unknown componentId: fail visibly (dev error), same spirit as the
    // Phase-0 stub's loud-failure preference — never silently render
    // nothing for a manifest entry that has no exemplar yet.
    return (
      <div data-component={componentId} data-reveal="absent">
        Unknown component: {label}
      </div>
    );
  }

  const reveal = deriveRevealState(componentId, state, REVEAL_CONFIG);

  if (reveal === "absent") {
    return (
      <div
        data-component={componentId}
        data-reveal="absent"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 48,
          minWidth: 96,
          padding: 12,
          border: "1px dashed #d8d6cc",
          borderRadius: 6,
          color: "#a8a69c",
          fontSize: 12,
          fontFamily: "inherit",
          transition: REVEAL_TRANSITION,
        }}
      >
        {label}
      </div>
    );
  }

  const confidence = componentConfidence(componentId, state, REVEAL_CONFIG);
  const blurPx = reveal === "sharp" ? 0 : blurPxForConfidence(confidence, REVEAL_CONFIG);
  const opacity = reveal === "sharp" ? 1 : opacityForConfidence(confidence, REVEAL_CONFIG);

  return (
    <div
      data-component={componentId}
      data-reveal={reveal}
      style={{
        display: "inline-flex",
        maxWidth: "100%",
        filter: blurPx > 0 ? `blur(${blurPx}px)` : "none",
        opacity,
        transition: REVEAL_TRANSITION,
      }}
    >
      <Entry />
    </div>
  );
};
