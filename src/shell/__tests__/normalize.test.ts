import { describe, expect, it } from "vitest";
import { NormalizedMessageSchema } from "@/contracts";
import {
  describeColorControl,
  describeRadiusControl,
  isNormalizedMessage,
  normalizeChatMessage,
  normalizeControlMessage,
  normalizeRegionMessage,
} from "../messages/normalize";

describe("normalizeChatMessage", () => {
  it("produces a valid ChatMessage shape", () => {
    const msg = normalizeChatMessage("  it's a booking app for dog groomers  ");
    expect(msg).toEqual({ channel: "chat", text: "it's a booking app for dog groomers" });
    expect(NormalizedMessageSchema.parse(msg)).toEqual(msg);
    expect(isNormalizedMessage(msg)).toBe(true);
  });
});

describe("normalizeRegionMessage", () => {
  it("resolves tokens-in-scope via the manifest for the given target", () => {
    const values: Record<string, string> = {
      "color.primary": "#5b7f5e",
      "color.onPrimary": "#ffffff",
      "shape.radius": "10px",
      "typography.label": "13px/500",
      "spacing.inset": "8px",
    };
    const msg = normalizeRegionMessage("button.primary", "feels too corporate", (ref) => values[ref]);
    expect(msg.channel).toBe("region");
    expect(msg.target).toBe("button.primary");
    expect(msg.text).toBe("feels too corporate");
    // Exactly the manifest-declared groups for button.primary, nothing more.
    expect(Object.keys(msg.tokensInScope).sort()).toEqual(
      ["color.primary", "color.onPrimary", "shape.radius", "typography.label", "spacing.inset"].sort(),
    );
    expect(msg.tokensInScope["color.primary"]).toBe("#5b7f5e");
    expect(NormalizedMessageSchema.parse(msg)).toEqual(msg);
  });

  it("omits tokens the resolver returns undefined for", () => {
    const msg = normalizeRegionMessage("badge.default", "too loud", () => undefined);
    expect(msg.tokensInScope).toEqual({});
  });

  it("returns an empty scope for an unknown target", () => {
    const msg = normalizeRegionMessage("not.a.component", "whatever", () => "x");
    expect(msg.tokensInScope).toEqual({});
  });
});

describe("normalizeControlMessage", () => {
  it("produces a valid ControlMessage shape", () => {
    const msg = normalizeControlMessage("color.primary", describeColorControl("color.primary", "#0f766e", "Primary"));
    expect(msg.channel).toBe("control");
    expect(msg.target).toBe("color.primary");
    expect(msg.text).toContain("#0f766e");
    expect(msg.text).toContain("swatch");
    expect(NormalizedMessageSchema.parse(msg)).toEqual(msg);
  });

  it("describeRadiusControl phrases a well-formed utterance", () => {
    const text = describeRadiusControl("shape.radius", 14, "Radius");
    expect(text).toContain("14px");
    expect(text).toContain("stepper");
  });
});

describe("isNormalizedMessage", () => {
  it("rejects non-message values", () => {
    expect(isNormalizedMessage(null)).toBe(false);
    expect(isNormalizedMessage({})).toBe(false);
    expect(isNormalizedMessage({ channel: "bogus" })).toBe(false);
  });
});
