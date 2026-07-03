/**
 * Color swatch control — a suggestion composer (IMPLEMENTATION.md #4:
 * "controls ... let the user express a precise value without typing hex
 * codes, but the output is a well-formed utterance fed to the model").
 * Never writes belief state directly: every change goes through
 * `onSettle`, which the parent turns into a `control` NormalizedMessage.
 *
 * Debounced (~800ms, useDebouncedControl) so rapid swatch drags collapse
 * into a single outgoing message; emits a pending-preview value on every
 * tick so the swatch itself (and the preview, via the parent) reflect the
 * in-progress pick immediately.
 */
"use client";

import { useState } from "react";
import { useDebouncedControl } from "./useDebouncedControl";

export interface ColorSwatchControlProps {
  dottedRef: string;
  label: string;
  value: string;
  onPending: (hex: string) => void;
  onSettle: (hex: string) => void;
  disabled?: boolean;
}

export function ColorSwatchControl({
  dottedRef,
  label,
  value,
  onPending,
  onSettle,
  disabled,
}: ColorSwatchControlProps) {
  const [local, setLocal] = useState(value);
  // Tracks the `value` prop this `local` was last synced from — lets us
  // detect "the belief state changed underneath us" during render and
  // resync inline (React's "adjusting state on prop change" pattern)
  // instead of via a setState-in-effect, which react-hooks/set-state-in-effect
  // flags as cascading-render-prone.
  const [syncedFrom, setSyncedFrom] = useState(value);
  const { set, flush } = useDebouncedControl<string>({ onSettle });

  // Resync from the real belief-state value once the model's patch lands
  // (pending preview reconciliation, IMPLEMENTATION.md #4).
  if (value !== syncedFrom) {
    setSyncedFrom(value);
    setLocal(value);
  }

  function handleChange(hex: string) {
    setLocal(hex);
    onPending(hex);
    set(hex);
  }

  return (
    <label
      className="flex items-center gap-2"
      data-testid={`color-swatch-${dottedRef}`}
      data-token-ref={dottedRef}
    >
      <span className="text-xs text-app-text-secondary">{label}</span>
      <input
        type="color"
        value={local}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={flush}
        className="h-6 w-6 cursor-pointer rounded-app-sm bg-transparent p-0 shadow-app-edge disabled:opacity-40"
        data-testid={`color-swatch-input-${dottedRef}`}
      />
    </label>
  );
}
