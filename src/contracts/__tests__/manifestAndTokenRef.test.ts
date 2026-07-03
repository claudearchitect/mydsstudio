import { describe, expect, it } from "vitest";
import { COMPONENT_MANIFEST, getManifestEntry, tokensInScopeFor } from "@/contracts/componentManifest";
import { parseTokenRef, formatTokenRef } from "@/contracts/tokenRef";
import { dsVarName } from "@/contracts/resolveTokens";

describe("component manifest", () => {
  it("declares exactly the 6 V0 exemplar components", () => {
    expect(COMPONENT_MANIFEST.map((c) => c.componentId).sort()).toEqual(
      [
        "badge.default",
        "button.primary",
        "card.default",
        "heading.default",
        "input.text",
        "nav.default",
      ].sort(),
    );
  });

  it("every declared tokenGroups entry is a valid dotted ref", () => {
    for (const entry of COMPONENT_MANIFEST) {
      for (const ref of entry.tokenGroups) {
        expect(() => parseTokenRef(ref)).not.toThrow();
      }
    }
  });

  it("tokensInScopeFor resolves via the manifest lookup", () => {
    const resolved = tokensInScopeFor("button.primary", (ref) =>
      ref === "color.primary" ? "#5b7f5e" : undefined,
    );
    expect(resolved).toEqual({ "color.primary": "#5b7f5e" });
  });

  it("getManifestEntry returns undefined for an unknown id", () => {
    expect(getManifestEntry("nope.nope")).toBeUndefined();
  });
});

describe("tokenRef helpers", () => {
  it("parseTokenRef / formatTokenRef round-trip", () => {
    const ref = "color.primary";
    const parsed = parseTokenRef(ref);
    expect(parsed).toEqual({ group: "color", token: "primary" });
    expect(formatTokenRef(parsed.group, parsed.token)).toBe(ref);
  });

  it("throws on a malformed ref", () => {
    expect(() => parseTokenRef("noDotHere")).toThrow();
    expect(() => parseTokenRef("bogus.primary")).toThrow();
  });
});

describe("dsVarName", () => {
  it("formats a dotted ref as --ds-<group>-<kebab-token>", () => {
    expect(dsVarName("color.primary")).toBe("--ds-color-primary");
    expect(dsVarName("color.onPrimary")).toBe("--ds-color-on-primary");
    expect(dsVarName("shape.radiusPill")).toBe("--ds-shape-radius-pill");
  });
});
