/**
 * useTurnMode — mode resolution + the auto-demotion path (V0_PLAN.md Phase 2
 * demo-mode scope addition; see useTurnMode.ts's header comment for the
 * full bug history this covers). The regression under test: a live turn
 * failing on its first turn used to demote via plain useState, which reset
 * on every fresh mount — the next page load re-resolved straight back to
 * "live", failed the same way, and demoted again, reading as "stuck on
 * Demo" even with a seemingly healthy key. `autoDemoted` now makes that
 * state visible instead of indistinguishable from a user's own choice, and
 * `retryLive` gives an explicit way back in.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "./testUtils";
import { useTurnMode } from "../turn/useTurnMode";

function mockHealth(available: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ available }),
    }),
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useTurnMode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves to demo before the health probe settles, then live once it reports available", async () => {
    mockHealth(true);
    const { result, unmount } = renderHook(() => useTurnMode());

    expect(result.current.resolved).toBe(false);
    expect(result.current.mode).toBe("demo");

    await flush();

    expect(result.current.resolved).toBe(true);
    expect(result.current.liveAvailable).toBe(true);
    expect(result.current.mode).toBe("live");

    unmount();
  });

  it("stays on demo when no key is configured server-side", async () => {
    mockHealth(false);
    const { result, unmount } = renderHook(() => useTurnMode());
    await flush();

    expect(result.current.resolved).toBe(true);
    expect(result.current.liveAvailable).toBe(false);
    expect(result.current.mode).toBe("demo");

    unmount();
  });

  it("falls back to demo if the health probe request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const { result, unmount } = renderHook(() => useTurnMode());
    await flush();

    expect(result.current.resolved).toBe(true);
    expect(result.current.liveAvailable).toBe(false);
    expect(result.current.mode).toBe("demo");

    unmount();
  });

  it("an explicit setMode wins over the resolved default", async () => {
    mockHealth(true);
    const { result, unmount } = renderHook(() => useTurnMode());
    await flush();
    expect(result.current.mode).toBe("live");

    act(() => result.current.setMode("demo"));
    expect(result.current.mode).toBe("demo");

    unmount();
  });

  it("reportLiveFailure demotes to demo on a demoting error code and records why via autoDemoted", async () => {
    mockHealth(true);
    const { result, unmount } = renderHook(() => useTurnMode());
    await flush();
    expect(result.current.mode).toBe("live");

    act(() => result.current.reportLiveFailure("server_error"));

    expect(result.current.mode).toBe("demo");
    expect(result.current.autoDemoted).toEqual({ code: "server_error" });

    unmount();
  });

  it("reportLiveFailure ignores non-demoting error codes (e.g. a transient rate limit)", async () => {
    mockHealth(true);
    const { result, unmount } = renderHook(() => useTurnMode());
    await flush();
    expect(result.current.mode).toBe("live");

    act(() => result.current.reportLiveFailure("rate_limit"));

    expect(result.current.mode).toBe("live");
    expect(result.current.autoDemoted).toBeNull();

    unmount();
  });

  it("retryLive clears an auto-demotion and returns to live", async () => {
    mockHealth(true);
    const { result, unmount } = renderHook(() => useTurnMode());
    await flush();

    act(() => result.current.reportLiveFailure("server_error"));
    expect(result.current.mode).toBe("demo");
    expect(result.current.autoDemoted).not.toBeNull();

    act(() => result.current.retryLive());

    expect(result.current.mode).toBe("live");
    expect(result.current.autoDemoted).toBeNull();

    unmount();
  });

  it("a user explicitly picking a mode clears a stale autoDemoted flag", async () => {
    mockHealth(true);
    const { result, unmount } = renderHook(() => useTurnMode());
    await flush();

    act(() => result.current.reportLiveFailure("server_error"));
    expect(result.current.autoDemoted).not.toBeNull();

    act(() => result.current.setMode("demo"));

    // A fresh, deliberate "demo" pick isn't the same thing as an
    // auto-demotion — the banner explaining an auto-demotion shouldn't
    // linger once the user has made their own choice.
    expect(result.current.autoDemoted).toBeNull();
    expect(result.current.mode).toBe("demo");

    unmount();
  });
});
