import { describe, expect, it, vi } from "vitest";
import { act, render } from "./testUtils";
import { getManifestEntry } from "@/contracts";
import { RegionSelectOverlay } from "../region/RegionSelectOverlay";

const values: Record<string, string> = {
  "color.primary": "#5b7f5e",
  "color.onPrimary": "#ffffff",
  "shape.radius": "10px",
  "typography.label": "13px/500",
  "spacing.inset": "8px",
};

function resolve(ref: string) {
  return values[ref];
}

describe("RegionSelectOverlay", () => {
  it("clicking a data-component element opens a popover reporting exactly the manifest-declared groups", () => {
    const onSubmitComment = vi.fn();
    const { container, unmount } = render(
      <RegionSelectOverlay resolve={resolve} onSubmitComment={onSubmitComment}>
        <button data-component="button.primary">Primary</button>
      </RegionSelectOverlay>,
    );

    const target = container.querySelector("[data-component='button.primary']")!;
    act(() => {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const popover = container.querySelector("[data-testid='region-comment-popover']");
    expect(popover).not.toBeNull();
    expect(popover!.getAttribute("data-target")).toBe("button.primary");

    const manifestEntry = getManifestEntry("button.primary")!;
    const tokenRows = Array.from(container.querySelectorAll("[data-token-ref]")).map((el) =>
      el.getAttribute("data-token-ref"),
    );
    expect(tokenRows.sort()).toEqual([...manifestEntry.tokenGroups].sort());

    unmount();
  });

  it("submits a region comment with the target and typed text", () => {
    const onSubmitComment = vi.fn();
    const { container, unmount } = render(
      <RegionSelectOverlay resolve={resolve} onSubmitComment={onSubmitComment}>
        <button data-component="button.primary">Primary</button>
      </RegionSelectOverlay>,
    );

    const target = container.querySelector("[data-component='button.primary']")!;
    act(() => {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const input = container.querySelector<HTMLInputElement>("[data-testid='region-comment-input']")!;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "feels too corporate");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const form = container.querySelector("form")!;
    act(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onSubmitComment).toHaveBeenCalledTimes(1);
    expect(onSubmitComment).toHaveBeenCalledWith("button.primary", "feels too corporate");

    unmount();
  });

  it("ignores clicks on elements without a data-component attribute", () => {
    const onSubmitComment = vi.fn();
    const { container, unmount } = render(
      <RegionSelectOverlay resolve={resolve} onSubmitComment={onSubmitComment}>
        <div data-testid="plain">not a component</div>
      </RegionSelectOverlay>,
    );

    const plain = container.querySelector("[data-testid='plain']")!;
    act(() => {
      plain.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector("[data-testid='region-comment-popover']")).toBeNull();
    unmount();
  });

  it("does not open a popover when disabled", () => {
    const onSubmitComment = vi.fn();
    const { container, unmount } = render(
      <RegionSelectOverlay resolve={resolve} onSubmitComment={onSubmitComment} disabled>
        <button data-component="button.primary">Primary</button>
      </RegionSelectOverlay>,
    );

    const target = container.querySelector("[data-component='button.primary']")!;
    act(() => {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector("[data-testid='region-comment-popover']")).toBeNull();
    unmount();
  });
});
