import { describe, expect, it, vi } from "vitest";
import { act, render } from "./testUtils";
import { RadiusStepper } from "../controls/RadiusStepper";
import { ColorSwatchControl } from "../controls/ColorSwatchControl";

describe("RadiusStepper debounce coalescing", () => {
  it("a rapid sequence of increment clicks produces exactly one settled onSettle call, with an immediate onPending per click", () => {
    vi.useFakeTimers();
    const onPending = vi.fn();
    const onSettle = vi.fn();

    const { container, unmount } = render(
      <RadiusStepper
        dottedRef="shape.radius"
        label="Radius"
        valuePx={6}
        step={2}
        onPending={onPending}
        onSettle={onSettle}
      />,
    );

    const inc = container.querySelector<HTMLButtonElement>("[data-testid='radius-stepper-inc-shape.radius']")!;

    // Simulate a rapid drag: five increments in quick succession.
    for (let i = 0; i < 5; i++) {
      act(() => {
        inc.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        vi.advanceTimersByTime(100); // well under the 800ms settle window
      });
    }

    // Every tick produced an immediate pending preview...
    expect(onPending).toHaveBeenCalledTimes(5);
    // ...but nothing has settled yet (timer kept resetting).
    expect(onSettle).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(800);
    });

    // Exactly one settled message, with the final coalesced value
    // (6 + 5*2 = 16).
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenCalledWith(16);

    unmount();
    vi.useRealTimers();
  });

  it("clamps to min/max and disables buttons at the bounds", () => {
    const { container, unmount } = render(
      <RadiusStepper
        dottedRef="shape.radius"
        label="Radius"
        valuePx={0}
        min={0}
        max={4}
        step={2}
        onPending={() => {}}
        onSettle={() => {}}
      />,
    );
    const dec = container.querySelector<HTMLButtonElement>("[data-testid='radius-stepper-dec-shape.radius']")!;
    expect(dec.disabled).toBe(true);
    unmount();
  });
});

describe("ColorSwatchControl debounce coalescing", () => {
  it("rapid color changes coalesce into one settled message", () => {
    vi.useFakeTimers();
    const onPending = vi.fn();
    const onSettle = vi.fn();

    const { container, unmount } = render(
      <ColorSwatchControl
        dottedRef="color.primary"
        label="Primary"
        value="#111111"
        onPending={onPending}
        onSettle={onSettle}
      />,
    );

    const input = container.querySelector<HTMLInputElement>("[data-testid='color-swatch-input-color.primary']")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

    for (const hex of ["#222222", "#333333", "#444444"]) {
      act(() => {
        setter.call(input, hex);
        input.dispatchEvent(new Event("change", { bubbles: true }));
        vi.advanceTimersByTime(100);
      });
    }

    expect(onPending).toHaveBeenCalledTimes(3);
    expect(onSettle).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenCalledWith("#444444");

    unmount();
    vi.useRealTimers();
  });
});
