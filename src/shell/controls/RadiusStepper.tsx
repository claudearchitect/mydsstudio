/**
 * Border-radius stepper — same suggestion-composer contract as
 * ColorSwatchControl (see that file's header comment). Debounced so a
 * rapid sequence of +/- clicks (or held-key repeats) settles into exactly
 * one outgoing `control` message.
 */
"use client";

import { useState } from "react";
import { useDebouncedControl } from "./useDebouncedControl";

export interface RadiusStepperProps {
  dottedRef: string;
  label: string;
  valuePx: number;
  step?: number;
  min?: number;
  max?: number;
  onPending: (px: number) => void;
  onSettle: (px: number) => void;
  disabled?: boolean;
}

export function RadiusStepper({
  dottedRef,
  label,
  valuePx,
  step = 2,
  min = 0,
  max = 48,
  onPending,
  onSettle,
  disabled,
}: RadiusStepperProps) {
  const [local, setLocal] = useState(valuePx);
  // See ColorSwatchControl.tsx for why this is an inline render-time resync
  // rather than a setState-in-effect.
  const [syncedFrom, setSyncedFrom] = useState(valuePx);
  const { set, flush } = useDebouncedControl<number>({ onSettle });

  if (valuePx !== syncedFrom) {
    setSyncedFrom(valuePx);
    setLocal(valuePx);
  }

  function nudge(delta: number) {
    const next = Math.min(max, Math.max(min, local + delta));
    setLocal(next);
    onPending(next);
    set(next);
  }

  return (
    <div
      className="flex items-center gap-2"
      data-testid={`radius-stepper-${dottedRef}`}
      data-token-ref={dottedRef}
    >
      <span className="text-xs text-app-text-secondary">{label}</span>
      <div className="flex items-center gap-1 rounded-app-sm bg-app-bg-input px-1 py-0.5 shadow-app-edge">
        <button
          type="button"
          disabled={disabled || local <= min}
          onClick={() => nudge(-step)}
          onBlur={flush}
          className="h-5 w-5 rounded-app-sm text-xs text-app-text hover:bg-app-bg-raised disabled:opacity-30"
          data-testid={`radius-stepper-dec-${dottedRef}`}
        >
          −
        </button>
        <span className="w-8 text-center text-xs tabular-nums text-app-text" data-testid={`radius-stepper-value-${dottedRef}`}>
          {local}px
        </span>
        <button
          type="button"
          disabled={disabled || local >= max}
          onClick={() => nudge(step)}
          onBlur={flush}
          className="h-5 w-5 rounded-app-sm text-xs text-app-text hover:bg-app-bg-raised disabled:opacity-30"
          data-testid={`radius-stepper-inc-${dottedRef}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
