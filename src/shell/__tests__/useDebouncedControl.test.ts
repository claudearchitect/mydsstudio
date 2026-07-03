import { act, renderHook } from "./testUtils";
import { describe, expect, it, vi } from "vitest";
import { useDebouncedControl } from "../controls/useDebouncedControl";

describe("useDebouncedControl", () => {
  it("coalesces a rapid sequence of set() calls into exactly one onSettle call", () => {
    vi.useFakeTimers();
    const onSettle = vi.fn();
    const { result } = renderHook(() => useDebouncedControl<number>({ onSettle, debounceMs: 800 }));

    act(() => {
      result.current.set(1);
    });
    act(() => {
      vi.advanceTimersByTime(200);
      result.current.set(2);
    });
    act(() => {
      vi.advanceTimersByTime(200);
      result.current.set(3);
    });
    act(() => {
      vi.advanceTimersByTime(200);
      result.current.set(4);
    });

    // Not yet settled — each call restarted the 800ms timer.
    expect(onSettle).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenCalledWith(4);

    vi.useRealTimers();
  });

  it("flush() fires onSettle synchronously with the latest pending value", () => {
    vi.useFakeTimers();
    const onSettle = vi.fn();
    const { result } = renderHook(() => useDebouncedControl<string>({ onSettle, debounceMs: 800 }));

    act(() => {
      result.current.set("a");
      result.current.set("b");
    });
    act(() => {
      result.current.flush();
    });

    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenCalledWith("b");

    // Further time passing must not fire it again.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onSettle).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("flush() is a no-op when nothing is pending", () => {
    vi.useFakeTimers();
    const onSettle = vi.fn();
    const { result } = renderHook(() => useDebouncedControl<number>({ onSettle, debounceMs: 800 }));

    act(() => {
      result.current.flush();
    });
    expect(onSettle).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("separate settle cycles each produce their own single message", () => {
    vi.useFakeTimers();
    const onSettle = vi.fn();
    const { result } = renderHook(() => useDebouncedControl<number>({ onSettle, debounceMs: 800 }));

    act(() => {
      result.current.set(1);
    });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(onSettle).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.set(2);
    });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(onSettle).toHaveBeenCalledTimes(2);
    expect(onSettle).toHaveBeenNthCalledWith(2, 2);

    vi.useRealTimers();
  });
});
