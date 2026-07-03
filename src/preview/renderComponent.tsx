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
    // Render the REAL component (on its neutral token fallbacks) rather than a
    // labeled box, so the zero state reads as a genuine, if unresolved, design
    // system — the user sees an actual button/card/input taking shape. Muted
    // (desaturated + faded) to communicate "not decided yet"; it gains colour
    // and sharpness as the relevant token groups earn confidence.
    return (
      <div
        data-component={componentId}
        data-reveal="absent"
        title={`${label} — resolves as the interview learns your preferences`}
        style={{
          display: "inline-flex",
          maxWidth: "100%",
          filter: "grayscale(0.85) opacity(0.4)",
          transition: REVEAL_TRANSITION,
        }}
      >
        <Entry />
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
