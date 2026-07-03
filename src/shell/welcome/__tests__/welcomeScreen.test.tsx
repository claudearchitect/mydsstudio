/**
 * Unit tests for WelcomeScreen (chrome, `--app-*` only). Uses the repo's
 * hand-rolled render/act helper instead of @testing-library/react, which
 * is not an installed dependency (AGENTS.md).
 */
import { describe, expect, it, vi } from "vitest";
import { act, render } from "@/shell/__tests__/testUtils";
import { WelcomeScreen } from "../WelcomeScreen";

function click(el: Element | null) {
  if (!el) throw new Error("element not found");
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("WelcomeScreen", () => {
  it("renders the tagline and starts in live mode when available", () => {
    const onStart = vi.fn();
    const { container } = render(
      <WelcomeScreen
        liveAvailable
        hasResumableSession={false}
        onStart={onStart}
      />,
    );

    expect(container.textContent).toContain(
      "Discover a design system by interview, not by form.",
    );

    const start = container.querySelector("[data-testid='welcome-start']");
    expect(start).not.toBeNull();
    click(start);

    expect(onStart).toHaveBeenCalledWith("live");
  });

  it("defaults to demo and disables live when live is unavailable", () => {
    const onStart = vi.fn();
    const { container } = render(
      <WelcomeScreen
        liveAvailable={false}
        hasResumableSession={false}
        onStart={onStart}
      />,
    );

    const liveOption = container.querySelector(
      "[data-testid='welcome-mode-live']",
    ) as HTMLButtonElement | null;
    expect(liveOption).not.toBeNull();
    expect(liveOption?.disabled).toBe(true);

    click(container.querySelector("[data-testid='welcome-start']"));

    expect(onStart).toHaveBeenCalledWith("demo");
  });

  it("shows the resume card and calls onResume when clicked", () => {
    const onStart = vi.fn();
    const onResume = vi.fn();
    const { container } = render(
      <WelcomeScreen
        liveAvailable
        hasResumableSession
        resumeSummary={{ product: "Acme Dashboard", savedAt: new Date().toISOString() }}
        onStart={onStart}
        onResume={onResume}
      />,
    );

    const card = container.querySelector("[data-testid='welcome-resume-card']");
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain("Acme Dashboard");

    click(container.querySelector("[data-testid='welcome-resume']"));

    expect(onResume).toHaveBeenCalledTimes(1);
  });
});
