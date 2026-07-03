/**
 * Debounce for control input (V0_PLAN.md Workstream B: "rapid control input
 * coalesces into one message (~800ms settle)"). Rapid drags of a stepper or
 * repeated swatch clicks should not create a message per tick — only the
 * settled value, ~800ms after the last change, produces one outgoing
 * message.
 *
 * This hook is UI-agnostic: it just coalesces a stream of values into a
 * single "settled" callback. It does not touch belief state (single-writer
 * invariant) — the caller wires the settled callback to a message-emitting
 * function (see ColorSwatchControl / RadiusStepper).
 */
import { useCallback, useEffect, useRef } from "react";

export const CONTROL_DEBOUNCE_MS = 800;

export interface UseDebouncedControlOptions<T> {
  /** Called once, ~debounceMs after the last `set` call with no further
   * calls in between. */
  onSettle: (value: T) => void;
  debounceMs?: number;
}

export interface UseDebouncedControlResult<T> {
  /** Call on every intermediate change (e.g. every drag tick). Updates the
   * pending value immediately for local/preview use and (re)starts the
   * settle timer. */
  set: (value: T) => void;
  /** Flush any pending debounce immediately (e.g. on blur / drag end) —
   * fires `onSettle` synchronously with the latest value if one is
   * pending, then clears the timer. */
  flush: () => void;
}

export function useDebouncedControl<T>({
  onSettle,
  debounceMs = CONTROL_DEBOUNCE_MS,
}: UseDebouncedControlOptions<T>): UseDebouncedControlResult<T> {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ value: T } | null>(null);
  const onSettleRef = useRef(onSettle);

  // Refs must not be written during render (react-hooks/refs) — keep the
  // latest callback in a ref via an effect so `set`/`flush` (stable
  // callbacks, see useCallback below) always call the current `onSettle`
  // without needing it in their own dependency arrays.
  useEffect(() => {
    onSettleRef.current = onSettle;
  }, [onSettle]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const set = useCallback(
    (value: T) => {
      pendingRef.current = { value };
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending) onSettleRef.current(pending.value);
      }, debounceMs);
    },
    [debounceMs],
  );

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) onSettleRef.current(pending.value);
  }, []);

  return { set, flush };
}
