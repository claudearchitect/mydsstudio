import { describe, expect, it } from "vitest";
import * as yaml from "js-yaml";
import {
  confidence01,
  confidence04,
  confidence07,
  confidence095,
  emptyBeliefState,
} from "@fixtures/beliefStates";
import { buildFrontMatter, parseFrontMatter, serializeFrontMatter } from "@/export/frontMatter";
import { LOW_CONFIDENCE_THRESHOLD } from "@/export/types";

const fixtures = {
  empty: emptyBeliefState,
  "0.1": confidence01,
  "0.4": confidence04,
  "0.7": confidence07,
  "0.95": confidence095,
};

describe("front matter round-trip", () => {
  for (const [name, state] of Object.entries(fixtures)) {
    it(`round-trips through js-yaml for the ${name} fixture`, () => {
      const block = serializeFrontMatter(state);
      expect(block.startsWith("---\n")).toBe(true);
      expect(block.endsWith("---\n")).toBe(true);

      const parsed = parseFrontMatter(block);
      const expected = buildFrontMatter(state);
      expect(parsed).toEqual(expected);
    });

    it(`every emitted token value matches the ${name} fixture exactly`, () => {
      const block = serializeFrontMatter(state);
      const parsed = parseFrontMatter(block);

      for (const [groupName, group] of Object.entries(state.groups)) {
        for (const [tokenName, token] of Object.entries(group!.tokens)) {
          const parsedToken = parsed.groups[groupName as keyof typeof parsed.groups]?.tokens[
            tokenName
          ];
          expect(parsedToken).toBeDefined();
          expect(parsedToken!.$value).toBe(token.$value);
          expect(parsedToken!.$type).toBe(token.$type);
          expect(parsedToken!.provenance).toEqual(token.provenance);
        }
      }
    });
  }

  it("plain js-yaml.load can parse the block independently (not just our parseFrontMatter)", () => {
    const block = serializeFrontMatter(confidence07);
    const inner = block.replace(/^---\n/, "").replace(/---\n$/, "");
    const parsed = yaml.load(inner) as ReturnType<typeof buildFrontMatter>;
    expect(parsed.product).toBe(confidence07.meta.product);
    expect(parsed.groups.color?.tokens.primary?.$value).toBe(
      confidence07.groups.color?.tokens.primary?.$value,
    );
  });
});

describe("low-confidence marking", () => {
  it("marks groups below the threshold as inferred in front matter", () => {
    const fm = buildFrontMatter(confidence01);
    expect(confidence01.groups.color?.confidence).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
    expect(fm.groups.color?.inferred).toBe(true);
  });

  it("does not mark high-confidence groups as inferred", () => {
    const fm = buildFrontMatter(confidence095);
    expect(confidence095.groups.color?.confidence).toBeGreaterThanOrEqual(
      LOW_CONFIDENCE_THRESHOLD,
    );
    expect(fm.groups.color?.inferred).toBe(false);
  });

  it("handles the 0.4 fixture's mixed group confidences correctly", () => {
    const fm = buildFrontMatter(confidence04);
    // color is 0.45 (below threshold), shape is 0.4 (below threshold)
    expect(fm.groups.color?.inferred).toBe(true);
    expect(fm.groups.shape?.inferred).toBe(true);
  });

  it("empty state produces empty groups with no crash", () => {
    const fm = buildFrontMatter(emptyBeliefState);
    expect(fm.groups).toEqual({});
    expect(fm.product).toBe("");
  });
});

describe("parseFrontMatter error handling", () => {
  it("throws a clear error when no front matter block is present", () => {
    expect(() => parseFrontMatter("# just a heading\n\nno front matter here")).toThrow(
      /front matter/i,
    );
  });
});
