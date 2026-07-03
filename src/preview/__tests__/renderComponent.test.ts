/**
 * No new deps (ground rule): renders into a detached jsdom container via
 * react-dom/client instead of @testing-library/react, which isn't
 * installed.
 */
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { COMPONENT_MANIFEST } from "@/contracts";
import { COMPONENT_REGISTRY } from "../components";
import { renderComponent } from "../renderComponent";
import {
  emptyBeliefState,
  confidence01,
  confidence095,
} from "@fixtures/beliefStates";

let container: HTMLDivElement;
let root: Root;

function mount(node: React.ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return container;
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
});

describe("component registry / manifest consistency", () => {
  it("has exactly one exemplar component per manifest entry", () => {
    const manifestIds = COMPONENT_MANIFEST.map((e) => e.componentId).sort();
    const registryIds = Object.keys(COMPONENT_REGISTRY).sort();
    expect(registryIds).toEqual(manifestIds);
  });
});

describe("renderComponent", () => {
  it("preserves data-component on the root node for every manifest entry (region-select depends on this)", () => {
    for (const entry of COMPONENT_MANIFEST) {
      const el = mount(renderComponent(confidence095, entry.componentId));
      const node = el.querySelector(
        `[data-component="${entry.componentId}"]`,
      );
      expect(node).not.toBeNull();
    }
  });

  it("renders data-reveal='absent' on the empty belief state", () => {
    const el = mount(renderComponent(emptyBeliefState, "button.primary"));
    const node = el.querySelector('[data-component="button.primary"]');
    expect(node?.getAttribute("data-reveal")).toBe("absent");
  });

  it("renders data-reveal='sharp' at 0.95 confidence", () => {
    const el = mount(renderComponent(confidence095, "button.primary"));
    const node = el.querySelector('[data-component="button.primary"]');
    expect(node?.getAttribute("data-reveal")).toBe("sharp");
  });

  it("renders data-reveal='absent' for the 0.1 fixture (untouched dependency groups)", () => {
    const el = mount(renderComponent(confidence01, "card.default"));
    const node = el.querySelector('[data-component="card.default"]');
    expect(node?.getAttribute("data-reveal")).toBe("absent");
  });

  it("mounts the actual exemplar element inside a sharp/blurred wrapper", () => {
    const el = mount(renderComponent(confidence095, "heading.default"));
    expect(el.querySelector("h2")).not.toBeNull();
  });
});
