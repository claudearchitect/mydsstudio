/**
 * Unit tests for the shell feedback family: errorCopy, TurnErrorBanner,
 * ErrorState, LoadingState. Uses the repo's hand-rolled render/act helper
 * (no @testing-library/react — not an installed dependency).
 */
import { describe, expect, it, vi } from "vitest";
import { act, render } from "@/shell/__tests__/testUtils";
import { TurnErrorBanner } from "../TurnErrorBanner";
import { ErrorState } from "../ErrorState";
import { LoadingState } from "../LoadingState";
import { friendlyError } from "../errorCopy";

describe("friendlyError", () => {
  it("returns suggestDemo true for a known code", () => {
    const result = friendlyError("empty_response");
    expect(result.suggestDemo).toBe(true);
    expect(result.canRetry).toBe(true);
    expect(result.title).toBeTruthy();
  });

  it("falls back to a generic error for an unknown code, including the message", () => {
    const result = friendlyError("some_unknown_code", "boom, detailed reason");
    expect(result.title).toBe("Something went wrong");
    expect(result.canRetry).toBe(true);
    expect(result.description).toContain("boom, detailed reason");
  });
});

describe("TurnErrorBanner", () => {
  it("renders transcript-error-banner, includes the raw message, and calls onRetry on click", () => {
    const onRetry = vi.fn();
    const { container } = render(
      <TurnErrorBanner code="server" message="upstream returned 503" onRetry={onRetry} />,
    );

    const banner = container.querySelector('[data-testid="transcript-error-banner"]');
    expect(banner).toBeTruthy();
    expect(container.textContent).toContain("upstream returned 503");

    const retryButton = container.querySelector('[data-testid="retry-button"]');
    expect(retryButton).toBeTruthy();
    act(() => {
      retryButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows error-switch-demo for a suggestDemo code with onSwitchToDemo, and calls it", () => {
    const onRetry = vi.fn();
    const onSwitchToDemo = vi.fn();
    const { container } = render(
      <TurnErrorBanner
        code="empty_response"
        message="no content blocks"
        onRetry={onRetry}
        onSwitchToDemo={onSwitchToDemo}
      />,
    );

    const demoButton = container.querySelector('[data-testid="error-switch-demo"]');
    expect(demoButton).toBeTruthy();
    act(() => {
      demoButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onSwitchToDemo).toHaveBeenCalledTimes(1);
  });

  it("does not render retry-button when canRetry is false", () => {
    const onRetry = vi.fn();
    const { container } = render(
      <TurnErrorBanner code="no_api_key" message="missing key" onRetry={onRetry} />,
    );
    expect(container.querySelector('[data-testid="retry-button"]')).toBeNull();
  });
});

describe("ErrorState", () => {
  it("renders error-state with retry and demo actions when applicable", () => {
    const onRetry = vi.fn();
    const onSwitchToDemo = vi.fn();
    const { container } = render(
      <ErrorState
        code="empty_response"
        message="details"
        onRetry={onRetry}
        onSwitchToDemo={onSwitchToDemo}
      />,
    );
    expect(container.querySelector('[data-testid="error-state"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="error-state-retry"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="error-state-demo"]')).toBeTruthy();
  });
});

describe("LoadingState", () => {
  it("renders session-loading and the default label text", () => {
    const { container } = render(<LoadingState />);
    const el = container.querySelector('[data-testid="session-loading"]');
    expect(el).toBeTruthy();
    expect(container.textContent).toContain("Starting your session…");
  });
});
