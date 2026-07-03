import { describe, expect, it } from "vitest";
import type { BeliefState } from "@/contracts";
import {
  REVEAL_CONFIG,
  deriveRevealState,
  blurPxForConfidence,
  opacityForConfidence,
  componentConfidence,
} from "../revealState";
import {
  emptyBeliefState,
  confidence01,
  confidence04,
  confidence07,
  confidence095,
} from "@fixtures/beliefStates";

function stateWithGroups(
  groups: BeliefState["groups"],
): BeliefState {
  return { ...emptyBeliefState, groups };
}

describe("deriveRevealState", () => {
  it("is 'absent' for every component on the empty belief state", () => {
    for (const id of [
      "button.primary",
      "card.default",
      "input.text",
      "heading.default",
      "badge.default",
      "nav.default",
    ]) {
      expect(deriveRevealState(id, emptyBeliefState)).toBe("absent");
    }
  });

  it("is 'absent' when a dependency group has never been touched, even if others are high-confidence", () => {
    // button.primary depends on color + shape + typography + spacing groups;
    // give it high-confidence color only.
    const state = stateWithGroups({
      color: {
        confidence: 0.99,
        tokens: {
          primary: { $value: "#000", $type: "color", provenance: [] },
        },
      },
    });
    expect(deriveRevealState("button.primary", state)).toBe("absent");
  });

  it("distinguishes absent (group missing) from blurred (group present, low confidence)", () => {
    // heading.default depends only on color + typography.
    const presentButLow = stateWithGroups({
      color: { confidence: 0.5, tokens: {} },
      typography: { confidence: 0.5, tokens: {} },
    });
    expect(deriveRevealState("heading.default", presentButLow)).toBe(
      "blurred",
    );

    const missingTypography = stateWithGroups({
      color: { confidence: 0.99, tokens: {} },
    });
    expect(deriveRevealState("heading.default", missingTypography)).toBe(
      "absent",
    );
  });

  it("is 'sharp' once combined confidence reaches the sharp threshold", () => {
    const state = stateWithGroups({
      color: { confidence: REVEAL_CONFIG.sharpThreshold, tokens: {} },
      typography: { confidence: 1, tokens: {} },
    });
    expect(deriveRevealState("heading.default", state)).toBe("sharp");
  });

  it("uses 'min' combine: a component is only as confident as its weakest dependency group", () => {
    const state = stateWithGroups({
      color: { confidence: 0.95, tokens: {} },
      typography: { confidence: 0.2, tokens: {} },
    });
    expect(componentConfidence("heading.default", state)).toBeCloseTo(0.2);
    expect(deriveRevealState("heading.default", state)).toBe("blurred");
  });

  it("rounds very-low-but-present confidence down to 'absent' via absentFloor", () => {
    const state = stateWithGroups({
      color: { confidence: 0.01, tokens: {} },
      typography: { confidence: 0.99, tokens: {} },
    });
    expect(deriveRevealState("heading.default", state)).toBe("absent");
  });

  it("matches the gate's fixture progression: 0.1 ~= empty, 0.4 partially blurred, 0.95 all sharp", () => {
    const ids = [
      "button.primary",
      "card.default",
      "input.text",
      "heading.default",
      "badge.default",
      "nav.default",
    ];

    const at01 = ids.map((id) => deriveRevealState(id, confidence01));
    // confidence-0.1 fixture only touches `color` (partially) — every
    // component depends on at least one other, untouched group.
    expect(at01.every((r) => r === "absent")).toBe(true);

    const at04 = ids.map((id) => deriveRevealState(id, confidence04));
    expect(at04.some((r) => r === "blurred" || r === "absent")).toBe(true);
    expect(at04.every((r) => r !== "sharp")).toBe(true);

    const at07 = ids.map((id) => deriveRevealState(id, confidence07));
    expect(at07.some((r) => r !== "absent")).toBe(true);

    const at095 = ids.map((id) => deriveRevealState(id, confidence095));
    expect(at095.every((r) => r === "sharp")).toBe(true);
  });
});

describe("blurPxForConfidence / opacityForConfidence", () => {
  it("blur is 0 and opacity is 1 at/above sharpThreshold", () => {
    expect(blurPxForConfidence(REVEAL_CONFIG.sharpThreshold)).toBe(0);
    expect(blurPxForConfidence(1)).toBe(0);
    expect(opacityForConfidence(REVEAL_CONFIG.sharpThreshold)).toBe(1);
    expect(opacityForConfidence(1)).toBe(1);
  });

  it("blur is maxBlurPx and opacity is minOpacity at/below absentFloor", () => {
    expect(blurPxForConfidence(REVEAL_CONFIG.absentFloor)).toBe(
      REVEAL_CONFIG.maxBlurPx,
    );
    expect(opacityForConfidence(REVEAL_CONFIG.absentFloor)).toBe(
      REVEAL_CONFIG.minOpacity,
    );
  });

  it("interpolates monotonically between the floor and the sharp threshold", () => {
    const mid = (REVEAL_CONFIG.absentFloor + REVEAL_CONFIG.sharpThreshold) / 2;
    const low = REVEAL_CONFIG.absentFloor + 0.01;
    const high = REVEAL_CONFIG.sharpThreshold - 0.01;
    expect(blurPxForConfidence(low)).toBeGreaterThan(blurPxForConfidence(mid));
    expect(blurPxForConfidence(mid)).toBeGreaterThan(blurPxForConfidence(high));
    expect(opacityForConfidence(low)).toBeLessThan(opacityForConfidence(mid));
    expect(opacityForConfidence(mid)).toBeLessThan(opacityForConfidence(high));
  });
});
