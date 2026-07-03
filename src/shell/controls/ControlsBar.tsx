/**
 * Controls bar — the slim docked bar under the preview pane (V0_PLAN.md
 * "Studio shell design" layout: "a slim docked controls bar (color
 * swatches, radius stepper)"). V0 scope: color + border-radius only
 * (V0_PLAN.md Scope: "controls-as-suggestion-composers (colors + border
 * radius only for V0)").
 *
 * Owns nothing about belief state — reads current values via
 * `lookupTokenValue`, reports pending (unconfirmed) values up via
 * `onPending` for the preview to render provisionally, and emits settled
 * `control` messages via `onSettle`.
 */
"use client";

import type { BeliefState } from "@/contracts";
import {
  describeColorControl,
  describeRadiusControl,
  normalizeControlMessage,
} from "../messages/normalize";
import { lookupTokenValue, parsePx } from "./tokenLookup";
import { ColorSwatchControl } from "./ColorSwatchControl";
import { RadiusStepper } from "./RadiusStepper";

const COLOR_CONTROLS: Array<{ ref: string; label: string; fallback: string }> = [
  { ref: "color.primary", label: "Primary", fallback: "#5b7f5e" },
  { ref: "color.accent", label: "Accent", fallback: "#d97757" },
];

const RADIUS_CONTROLS: Array<{ ref: string; label: string; fallback: number }> = [
  { ref: "shape.radius", label: "Radius", fallback: 6 },
];

export interface ControlsBarProps {
  beliefState: BeliefState;
  disabled?: boolean;
  onPendingChange: (dottedRef: string, $value: string | number, $type: "color" | "dimension") => void;
  onSendMessage: (target: string, text: string, displayText?: string) => void;
}

export function ControlsBar({
  beliefState,
  disabled,
  onPendingChange,
  onSendMessage,
}: ControlsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4" data-testid="controls-bar">
      {COLOR_CONTROLS.map(({ ref, label, fallback }) => {
        const raw = lookupTokenValue(beliefState, ref);
        const value = typeof raw === "string" ? raw : fallback;
        return (
          <ColorSwatchControl
            key={ref}
            dottedRef={ref}
            label={label}
            value={value}
            disabled={disabled}
            onPending={(hex) => onPendingChange(ref, hex, "color")}
            onSettle={(hex) => {
              const msg = normalizeControlMessage(ref, describeColorControl(ref, hex, label));
              onSendMessage(msg.target, msg.text, `${label} → ${hex}`);
            }}
          />
        );
      })}

      {RADIUS_CONTROLS.map(({ ref, label, fallback }) => {
        const raw = lookupTokenValue(beliefState, ref);
        const valuePx = parsePx(raw, fallback);
        return (
          <RadiusStepper
            key={ref}
            dottedRef={ref}
            label={label}
            valuePx={valuePx}
            disabled={disabled}
            onPending={(px) => onPendingChange(ref, `${px}px`, "dimension")}
            onSettle={(px) => {
              const msg = normalizeControlMessage(ref, describeRadiusControl(ref, px, label));
              onSendMessage(msg.target, msg.text, `${label} → ${px}px`);
            }}
          />
        );
      })}
    </div>
  );
}
