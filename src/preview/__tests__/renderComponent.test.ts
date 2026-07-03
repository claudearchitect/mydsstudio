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
import { resolveTokens } from "@/contracts";
import {
  emptyBeliefState,
  confidence01,
  confidence04,
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

describe("enriched exemplar components read as real UI (not gray boxes)", () => {
  it("button.primary renders real button chrome: two buttons, real labels, no placeholder text", () => {
    const el = mount(renderComponent(confidence095, "button.primary"));
    const buttons = el.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    const labels = Array.from(buttons).map((b) => b.textContent);
    expect(labels.some((t) => /book/i.test(t ?? ""))).toBe(true);
    expect(el.textContent).not.toMatch(/^button\.primary$/i);
  });

  it("card.default renders a heading, body copy, and an action button", () => {
    const el = mount(renderComponent(confidence095, "card.default"));
    expect(el.querySelector("button")).not.toBeNull();
    // real body copy, not a placeholder gray bar (no text content)
    const paragraph = el.querySelector("p");
    expect(paragraph?.textContent?.length ?? 0).toBeGreaterThan(10);
  });

  it("input.text renders a real labeled field with a placeholder", () => {
    const el = mount(renderComponent(confidence095, "input.text"));
    const label = el.querySelector("label");
    const input = el.querySelector("input[type='text']");
    expect(label).not.toBeNull();
    expect(label?.textContent?.length ?? 0).toBeGreaterThan(0);
    expect(input?.getAttribute("placeholder")).toBeTruthy();
  });

  it("badge.default renders a realistic pill label, not generic 'New'", () => {
    const el = mount(renderComponent(confidence095, "badge.default"));
    expect(el.textContent).toMatch(/available/i);
  });

  it("nav.default renders a brand and multiple links plus an action", () => {
    const el = mount(renderComponent(confidence095, "nav.default"));
    const nav = el.querySelector("nav");
    expect(nav).not.toBeNull();
    expect(nav?.querySelector("button")).not.toBeNull();
    expect(el.textContent).toMatch(/book/i);
  });

  it("heading.default renders a heading paired with supporting body copy", () => {
    const el = mount(renderComponent(confidence095, "heading.default"));
    expect(el.querySelector("h2")).not.toBeNull();
    expect(el.querySelector("p")).not.toBeNull();
  });
});

describe("richer components still preserve data-component + reveal state", () => {
  it("preserves data-component on the root for every manifest entry at 0.4 (blurred) confidence", () => {
    for (const entry of COMPONENT_MANIFEST) {
      const el = mount(renderComponent(confidence04, entry.componentId));
      const node = el.querySelector(`[data-component="${entry.componentId}"]`);
      expect(node).not.toBeNull();
    }
  });

  it("applies blur filter + reduced opacity to the wrapper without breaking internal layout at blurred reveal", () => {
    // heading.default depends only on color + typography, both touched
    // (below sharp threshold) at the 0.4 fixture, so it lands in
    // "blurred" rather than "absent" — see revealState.test.ts's note on
    // why 0.4 is deliberately constructed this way.
    const el = mount(renderComponent(confidence04, "heading.default"));
    const node = el.querySelector<HTMLElement>('[data-component="heading.default"]');
    expect(node?.getAttribute("data-reveal")).toBe("blurred");
    expect(node?.style.filter).toMatch(/blur\(/);
    expect(Number(node?.style.opacity)).toBeLessThan(1);
    // internal structure (heading + supporting body copy) still mounts
    // under blur — a blurred heading should still read as a soft type
    // specimen, not an empty node.
    expect(node?.querySelector("h2")).not.toBeNull();
    expect(node?.querySelector("p")).not.toBeNull();
  });

  it("sharp reveal has no blur/opacity dampening applied to richer markup", () => {
    const el = mount(renderComponent(confidence095, "nav.default"));
    const node = el.querySelector<HTMLElement>('[data-component="nav.default"]');
    expect(node?.getAttribute("data-reveal")).toBe("sharp");
    expect(node?.style.filter === "" || node?.style.filter === "none").toBe(true);
    expect(node?.style.opacity === "" || Number(node?.style.opacity) === 1).toBe(true);
  });
});

describe("components stay shrinkable for the proposal picker's compact (~180px) cards", () => {
  // The proposal picker (src/shell/chat/ProposalPicker.tsx) renders these
  // same components inside a 2-column grid of ~180px cards. jsdom doesn't
  // do real layout, so this can't assert final pixel widths — instead it
  // asserts the *styling contract* that makes shrinking possible: the
  // reveal wrapper must allow shrinking (maxWidth: 100%, not an unbounded
  // inline-flex), and any component with a fixed "ideal" pixel width must
  // cap it against 100% (via `min(<ideal>, 100%)` or an explicit maxWidth)
  // rather than a bare px value that would overflow a narrow ancestor.
  it("the reveal wrapper caps its own width at 100% so it can shrink inside a compact card", () => {
    for (const entry of COMPONENT_MANIFEST) {
      const el = mount(renderComponent(confidence095, entry.componentId));
      const node = el.querySelector<HTMLElement>(
        `[data-component="${entry.componentId}"]`,
      );
      expect(node?.style.maxWidth).toBe("100%");
    }
  });

  it("card.default, input.text, and nav.default cap their fixed ideal width against 100% (min(px, 100%))", async () => {
    // jsdom's CSSOM (cssstyle) doesn't parse the `min()` CSS function at
    // all — assigning `style.width = "min(240px, 100%)"` is silently
    // dropped, so `element.style.width` reads back empty either way and
    // can't distinguish "capped" from "never set". Verified live in Chrome
    // (see PR description / worktree verification) that the real browser
    // renders these correctly at 180px. Asserting at the source level is
    // the reliable way to guard the *contract* — every fixed-width
    // component must express its width as `min(<px>, 100%)` rather than a
    // bare px value that would overflow the proposal picker's compact
    // card.
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.join(__dirname, "..", "components");
    const files: Record<string, string> = {
      "card.default": "CardDefault.tsx",
      "input.text": "InputText.tsx",
      "nav.default": "NavDefault.tsx",
    };
    for (const [componentId, file] of Object.entries(files)) {
      const src = await fs.readFile(path.join(dir, file), "utf-8");
      expect(src, `${componentId} (${file}) should cap its fixed width via min(px, 100%)`).toMatch(
        /width:\s*"min\(\d+px,\s*100%\)"/,
      );
    }
  });
});

describe("visual proposals: a token patch visibly restyles the enriched components", () => {
  it("button.primary's rendered background reflects the resolved --ds-color-primary value", () => {
    const el = mount(renderComponent(confidence095, "button.primary"));
    const resolved = resolveTokens(confidence095);
    const primaryButton = el.querySelector("button");
    // jsdom doesn't resolve CSS custom properties in computed style, but the
    // inline style attribute must reference the token var (not a hardcoded
    // literal) so a runtime token-var change on the ancestor restyles it.
    expect(primaryButton?.style.background).toContain("--ds-color-primary");
    expect(resolved["--ds-color-primary"]).toBe("#5b7f5e");
  });

  it("changing shape.radius in the belief state changes the resolved --ds-shape-radius the card references", () => {
    const mutated = {
      ...confidence095,
      groups: {
        ...confidence095.groups,
        shape: {
          ...confidence095.groups.shape!,
          tokens: {
            ...confidence095.groups.shape!.tokens,
            radius: { $value: "2px", $type: "dimension" as const, provenance: ["e99"] },
          },
        },
      },
    };
    const before = resolveTokens(confidence095);
    const after = resolveTokens(mutated);
    expect(before["--ds-shape-radius"]).toBe("10px");
    expect(after["--ds-shape-radius"]).toBe("2px");

    const el = mount(renderComponent(mutated, "card.default"));
    const card = el.querySelector<HTMLElement>('[data-component="card.default"]');
    expect(card?.querySelector("div")?.style.borderRadius).toContain(
      "--ds-shape-radius",
    );
  });
});
