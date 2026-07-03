import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { confidence07 } from "@fixtures/beliefStates";
import { ExportPanel } from "@/export/ExportPanel";
import { serializeDesignMd } from "@/export/serializeDesignMd";
import { deriveTranscript } from "@/export/deriveTranscript";

describe("ExportPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("mounts standalone without any shell context and shows export controls", () => {
    act(() => {
      root.render(<ExportPanel state={confidence07} />);
    });

    const panel = container.querySelector("[data-export-panel]");
    expect(panel).toBeTruthy();
    expect(container.textContent).toContain("Export design.md");
    expect(container.textContent).toContain("Download design.md");
    expect(container.textContent).toContain("View raw");
  });

  it("respects a custom filename prop in the download button label", () => {
    act(() => {
      root.render(<ExportPanel state={confidence07} filename="my-design.md" />);
    });
    expect(container.textContent).toContain("Download my-design.md");
  });

  it("view raw toggles a <pre> containing the serialized design.md content", () => {
    act(() => {
      root.render(<ExportPanel state={confidence07} />);
    });

    expect(container.querySelector("[data-export-raw]")).toBeNull();

    const viewRawButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "View raw",
    )!;
    act(() => {
      viewRawButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const raw = container.querySelector("[data-export-raw]");
    expect(raw).toBeTruthy();

    const expected = serializeDesignMd(confidence07, deriveTranscript(confidence07));
    expect(raw!.textContent).toBe(expected);
  });

  it("passing an explicit transcript overrides the derived one", () => {
    act(() => {
      root.render(
        <ExportPanel
          state={confidence07}
          transcript={[{ speaker: "user", text: "custom transcript line" }]}
        />,
      );
    });

    const viewRawButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "View raw",
    )!;
    act(() => {
      viewRawButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const raw = container.querySelector("[data-export-raw]");
    expect(raw!.textContent).toContain("custom transcript line");
  });
});
