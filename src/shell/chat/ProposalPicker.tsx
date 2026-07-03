/**
 * Proposal picker — renders a `propose` Interaction's 2-4 variants side by
 * side (IMPLEMENTATION.md #3 "Proposals are token patches"). Each variant
 * is rendered via `renderComponent(applyPatch(state, patch, throwawayId),
 * target)`: the client never interprets a patch, it just applies-and-draws
 * it, same renderer as the main preview.
 *
 * A pick is captured as a chat message describing the choice (never applies
 * the patch client-side — single-writer invariant: only the agent's own
 * `update_beliefs` on the *next* turn actually commits the change; picking
 * "Rounder" here just tells the model that's what the user chose). Always
 * offers a "none of these" escape per IMPLEMENTATION.md #3's ask-escape
 * rule, mirrored here for proposals.
 *
 * `renderComponent` is passed in (defaults to the Phase-0 placeholder) so
 * Workstream A's real implementation drops in without this component
 * changing (same signature, per contracts/renderComponent.tsx).
 */
"use client";

import { useMemo, type CSSProperties } from "react";
import {
  applyPatch,
  getManifestEntry,
  parseTokenRef,
  resolveTokens,
  renderComponentPlaceholder,
  COMPONENT_MANIFEST,
  type BeliefState,
  type ProposeInteraction,
  type ProposalVariant,
  type RenderComponent,
  type TokenGroupName,
} from "@/contracts";

/** Confidence forced onto a proposal target's dependency groups for the
 * picker's display render only (never written to real state). */
const SHARP_DISPLAY_CONFIDENCE = 0.95;

/**
 * Resolve a proposal's `target` to a real componentId. The interaction schema
 * intends `target` to be an exact componentId, but the live model sometimes
 * fills it with a free-text description ("Card + button + input on the
 * dashboard") rather than an id — which would render "Unknown component".
 * Map it back: exact id → manifest label → keyword mention → safe default, so
 * a proposal always renders a real component the variant patch visibly styles.
 */
function resolveComponentId(raw: string): string {
  if (COMPONENT_MANIFEST.some((e) => e.componentId === raw)) return raw;
  const lower = raw.toLowerCase();
  const byLabel = COMPONENT_MANIFEST.find((e) => e.label.toLowerCase() === lower);
  if (byLabel) return byLabel.componentId;
  const byKeyword = COMPONENT_MANIFEST.find((e) => {
    const family = e.componentId.split(".")[0]; // button, card, input, heading, badge, nav
    const labelWord = e.label.toLowerCase().split(" ").pop() ?? "";
    return lower.includes(family) || (labelWord.length > 2 && lower.includes(labelWord));
  });
  return byKeyword?.componentId ?? "button.primary";
}

/**
 * Display-only transform: raise the target component's dependency groups to
 * full confidence so the real component renders SHARP in the picker,
 * regardless of ambient session confidence. A proposal is a *focused
 * comparison* of the probed axis — reveal-state uncertainty belongs to the
 * ambient preview, not here. Without this, a color proposal made before
 * shape/typography/spacing are decided renders the button "absent" (a
 * colorless placeholder), hiding the very axis being compared. Unset tokens
 * fall back to the components' neutral defaults; the variant's own patch
 * supplies the probed value. Not written to state.events or persisted.
 */
function sharpenForTarget(s: BeliefState, target: string): BeliefState {
  const entry = getManifestEntry(target);
  if (!entry) return s;
  const groups = { ...s.groups };
  for (const ref of entry.tokenGroups) {
    const group = parseTokenRef(ref).group as TokenGroupName;
    const existing = groups[group];
    groups[group] = {
      confidence: Math.max(existing?.confidence ?? 0, SHARP_DISPLAY_CONFIDENCE),
      tokens: existing?.tokens ?? {},
    };
  }
  return { ...s, groups };
}

export interface ProposalPickerProps {
  state: BeliefState;
  interaction: ProposeInteraction;
  onPick: (variant: ProposalVariant) => void;
  onNoneOfThese: () => void;
  disabled?: boolean;
  renderComponent?: RenderComponent;
}

export function ProposalPicker({
  state,
  interaction,
  onPick,
  onNoneOfThese,
  disabled,
  renderComponent = renderComponentPlaceholder,
}: ProposalPickerProps) {
  // A throwaway id — this preview render is never appended to state.events;
  // applyPatch's eventId is only used for provenance stamping on the
  // scratch copy discarded after this render (contracts/applyPatch.ts:
  // "caller owns event-id generation and event-log appends").
  // The model's `target` may be prose, not a componentId — resolve it to a
  // real component so the variants always render (see resolveComponentId).
  const target = resolveComponentId(interaction.target);
  // Card and nav exemplars have wide intrinsic min-widths (240px / 320px) that
  // don't fit two-across in the ~420px chat column — a 2-col grid there
  // overflows and pushes a horizontal scrollbar onto the whole transcript.
  // Give wide targets a single column so each variant gets the full width.
  const family = target.split(".")[0];
  const wideTarget = family === "card" || family === "nav";
  const variantStates = useMemo(
    () =>
      interaction.variants.map((variant) => ({
        variant,
        previewState: sharpenForTarget(
          applyPatch(state, variant.patch, `preview-${variant.id}`),
          target,
        ),
      })),
    [state, interaction.variants, target],
  );

  return (
    <div
      className="rounded-app-lg bg-app-bg-raised p-3 shadow-app-card"
      data-testid="proposal-picker"
      data-axis={interaction.axis.join(",")}
      data-target={interaction.target}
    >
      <p className="mb-3 text-sm text-app-text">{interaction.caption}</p>
      <div className={`grid gap-2 ${wideTarget ? "grid-cols-1" : "grid-cols-2"}`}>
        {variantStates.map(({ variant, previewState }) => (
          // A clickable div, not a <button>: the rendered variant is a real
          // component that can itself contain a <button>/<input> (e.g.
          // button.primary, nav) — nesting those in a <button> is invalid HTML
          // and triggers hydration errors. role/tabIndex/keydown keep it
          // keyboard-accessible.
          <div
            key={variant.id}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onClick={() => {
              if (!disabled) onPick(variant);
            }}
            onKeyDown={(e) => {
              if (!disabled && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onPick(variant);
              }
            }}
            className={`flex min-w-0 flex-col items-center gap-2 overflow-hidden rounded-app-md bg-app-paper p-3 text-left shadow-app-edge transition-shadow ${
              disabled ? "cursor-default opacity-40" : "cursor-pointer hover:shadow-app-focus"
            }`}
            data-testid={`proposal-variant-${variant.id}`}
          >
            <div
              className="ds-preview-root flex w-full items-center justify-center overflow-x-auto rounded-app-sm p-2"
              style={{ ...(resolveTokens(previewState) as CSSProperties), pointerEvents: "none" }}
            >
              {renderComponent(previewState, target)}
            </div>
            <span className="text-xs font-medium" style={{ color: "#2b2a26" }}>
              {variant.caption}
            </span>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onNoneOfThese}
        className="mt-3 text-xs text-app-text-muted underline decoration-dotted hover:text-app-text-secondary disabled:opacity-40"
        data-testid="proposal-none-of-these"
      >
        None of these
      </button>
    </div>
  );
}
