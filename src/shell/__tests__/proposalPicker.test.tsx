import { describe, expect, it, vi } from "vitest";
import { act, render } from "./testUtils";
import { EMPTY_TOKEN_PATCH, type BeliefState, type ProposeInteraction } from "@/contracts";
import { ProposalPicker } from "../chat/ProposalPicker";

function baseState(): BeliefState {
  return {
    schemaVersion: 1,
    meta: { product: "", audience: "", personality: [] },
    groups: {
      color: { confidence: 0.2, tokens: { primary: { $value: "#111111", $type: "color", provenance: [] } } },
    },
    rationale: [],
    events: [],
  };
}

const interaction: ProposeInteraction = {
  mode: "propose",
  axis: ["color.primary"],
  target: "button.primary",
  caption: "Which primary color feels closer to right?",
  variants: [
    {
      id: "v-green",
      caption: "Muted green",
      patch: { ...EMPTY_TOKEN_PATCH, tokens: [{ group: "color", token: "primary", $value: "#5b7f5e", $type: "color" }] },
    },
    {
      id: "v-teal",
      caption: "Bold teal",
      patch: { ...EMPTY_TOKEN_PATCH, tokens: [{ group: "color", token: "primary", $value: "#0f766e", $type: "color" }] },
    },
  ],
};

describe("ProposalPicker", () => {
  it("renders one card per variant, distinctly patched, without mutating the base state", () => {
    const state = baseState();
    const { container, unmount } = render(
      <ProposalPicker state={state} interaction={interaction} onPick={() => {}} onNoneOfThese={() => {}} />,
    );

    const cards = container.querySelectorAll("[data-testid^='proposal-variant-']");
    expect(cards).toHaveLength(2);
    expect(container.querySelector("[data-testid='proposal-variant-v-green']")).not.toBeNull();
    expect(container.querySelector("[data-testid='proposal-variant-v-teal']")).not.toBeNull();

    // The base state passed in must remain untouched (applyPatch purity,
    // single-writer invariant: the picker only *previews*, never commits).
    expect(state.groups.color?.tokens.primary?.$value).toBe("#111111");

    unmount();
  });

  it("calls onPick with the chosen variant and does not itself write belief state", () => {
    const state = baseState();
    const onPick = vi.fn();
    const { container, unmount } = render(
      <ProposalPicker state={state} interaction={interaction} onPick={onPick} onNoneOfThese={() => {}} />,
    );

    const greenButton = container.querySelector<HTMLButtonElement>(
      "[data-testid='proposal-variant-v-green']",
    )!;
    act(() => {
      greenButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(interaction.variants[0]);
    // Base state still untouched — pick is captured as a message, not a
    // direct mutation (IMPLEMENTATION.md #1 single writer).
    expect(state.groups.color?.tokens.primary?.$value).toBe("#111111");

    unmount();
  });

  it("offers a 'none of these' escape", () => {
    const state = baseState();
    const onNoneOfThese = vi.fn();
    const { container, unmount } = render(
      <ProposalPicker state={state} interaction={interaction} onPick={() => {}} onNoneOfThese={onNoneOfThese} />,
    );

    const escapeButton = container.querySelector<HTMLButtonElement>(
      "[data-testid='proposal-none-of-these']",
    )!;
    act(() => {
      escapeButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onNoneOfThese).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("renders each variant against its own applied patch (distinct previews)", () => {
    const state = baseState();
    const seen: string[] = [];
    const renderComponent = (s: BeliefState) => {
      seen.push(String(s.groups.color?.tokens.primary?.$value));
      return <div data-testid="stub" />;
    };
    const { unmount } = render(
      <ProposalPicker
        state={state}
        interaction={interaction}
        onPick={() => {}}
        onNoneOfThese={() => {}}
        renderComponent={renderComponent}
      />,
    );

    expect(seen.sort()).toEqual(["#0f766e", "#5b7f5e"]);
    unmount();
  });
});
