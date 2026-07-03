import { describe, expect, it } from "vitest";
import {
  confidence01,
  confidence04,
  confidence07,
  confidence095,
  emptyBeliefState,
} from "@fixtures/beliefStates";
import type { BeliefState } from "@/contracts";
import { deriveTranscript } from "@/export/deriveTranscript";
import { parseFrontMatter } from "@/export/frontMatter";
import { serializeDesignMd } from "@/export/serializeDesignMd";
import { SECTION_ORDER } from "@/export/types";

const fixtures: Record<string, BeliefState> = {
  empty: emptyBeliefState,
  "0.1": confidence01,
  "0.4": confidence04,
  "0.7": confidence07,
  "0.95": confidence095,
};

describe("serializeDesignMd — gate: each confidence fixture", () => {
  for (const [name, state] of Object.entries(fixtures)) {
    it(`${name} fixture serializes to a parseable design.md with matching token values`, () => {
      const md = serializeDesignMd(state, deriveTranscript(state));

      // Parseable front matter.
      const fm = parseFrontMatter(md);

      // Every token in the belief state appears in the front matter with an
      // exact value match.
      for (const [groupName, group] of Object.entries(state.groups)) {
        const fmGroup = fm.groups[groupName as keyof typeof fm.groups];
        expect(fmGroup).toBeDefined();
        for (const [tokenName, token] of Object.entries(group!.tokens)) {
          const fmToken = fmGroup!.tokens[tokenName];
          expect(fmToken).toBeDefined();
          expect(fmToken!.$value).toBe(token.$value);
          expect(fmToken!.$type).toBe(token.$type);
        }
      }
    });
  }
});

describe("serializeDesignMd — canonical section order", () => {
  it("matches the spec order exactly for a fully-resolved fixture", () => {
    const md = serializeDesignMd(confidence095, deriveTranscript(confidence095));
    const headingRegex = /^## (.+)$/gm;
    const found: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = headingRegex.exec(md)) !== null) {
      found.push(m[1]);
    }
    expect(found).toEqual([...SECTION_ORDER]);
  });

  it("preserves order even for the empty fixture (structurally complete, not omitted)", () => {
    const md = serializeDesignMd(emptyBeliefState, []);
    const headingRegex = /^## (.+)$/gm;
    const found: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = headingRegex.exec(md)) !== null) {
      found.push(m[1]);
    }
    expect(found).toEqual([...SECTION_ORDER]);
  });

  it("preserves order across all confidence fixtures", () => {
    for (const state of Object.values(fixtures)) {
      const md = serializeDesignMd(state, deriveTranscript(state));
      const headingRegex = /^## (.+)$/gm;
      const found: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = headingRegex.exec(md)) !== null) {
        found.push(m[1]);
      }
      expect(found).toEqual([...SECTION_ORDER]);
    }
  });
});

describe("serializeDesignMd — token traceability", () => {
  it("every token value that appears in prose also appears in front matter (traces to belief state)", () => {
    const state = confidence07;
    const md = serializeDesignMd(state, deriveTranscript(state));
    const fm = parseFrontMatter(md);

    for (const [groupName, group] of Object.entries(state.groups)) {
      for (const [tokenName] of Object.entries(group!.tokens)) {
        // The dotted ref should appear literally in the prose body (we emit
        // `group.token` bullets in each section).
        expect(md).toContain(`${groupName}.${tokenName}`);
        // And the value must match the belief state exactly via front matter.
        const fmToken = fm.groups[groupName as keyof typeof fm.groups]?.tokens[tokenName];
        expect(fmToken?.$value).toBe(group!.tokens[tokenName].$value);
      }
    }
  });

  it("does not invent tokens that aren't in the belief state", () => {
    const state = confidence04;
    const md = serializeDesignMd(state, deriveTranscript(state));
    const fm = parseFrontMatter(md);

    const fmTokenRefs = new Set<string>();
    for (const [groupName, group] of Object.entries(fm.groups)) {
      for (const tokenName of Object.keys(group!.tokens)) {
        fmTokenRefs.add(`${groupName}.${tokenName}`);
      }
    }
    const stateTokenRefs = new Set<string>();
    for (const [groupName, group] of Object.entries(state.groups)) {
      for (const tokenName of Object.keys(group!.tokens)) {
        stateTokenRefs.add(`${groupName}.${tokenName}`);
      }
    }
    expect(fmTokenRefs).toEqual(stateTokenRefs);
  });
});

describe("serializeDesignMd — low-confidence marking", () => {
  it("marks the low-confidence color group as inferred in both front matter and prose (0.1 fixture)", () => {
    const md = serializeDesignMd(confidence01, deriveTranscript(confidence01));
    const fm = parseFrontMatter(md);
    expect(fm.groups.color?.inferred).toBe(true);

    // Prose: the Colors section should carry the "inferred, not confirmed" note.
    const colorsSection = md.split("## Colors")[1].split("## Typography")[0];
    expect(colorsSection).toMatch(/inferred, not confirmed/i);
  });

  it("does not mark high-confidence groups as inferred in prose (0.95 fixture)", () => {
    const md = serializeDesignMd(confidence095, deriveTranscript(confidence095));
    const colorsSection = md.split("## Colors")[1].split("## Typography")[0];
    expect(colorsSection).not.toMatch(/inferred, not confirmed/i);
  });

  it("marks absent groups with an explicit not-captured note rather than omitting the section", () => {
    const md = serializeDesignMd(confidence01, deriveTranscript(confidence01));
    // confidence01 only has `color`; typography/shape/elevation/spacing absent.
    const typographySection = md.split("## Typography")[1].split("## Layout")[0];
    expect(typographySection).toMatch(/captured yet/i);
  });
});

describe("serializeDesignMd — prose reflects transcript", () => {
  it("includes user-said lines from the transcript in the Overview", () => {
    const state = confidence04;
    const transcript = deriveTranscript(state);
    const md = serializeDesignMd(state, transcript);
    const overview = md.split("## Overview")[1].split("## Colors")[0];
    expect(overview).toContain("it's a booking app for dog groomers");
  });

  it("defaults to an empty transcript when omitted (still valid output)", () => {
    const md = serializeDesignMd(confidence07);
    expect(() => parseFrontMatter(md)).not.toThrow();
  });
});
