/**
 * Component manifest — componentId -> dotted token-ref dependencies
 * (IMPLEMENTATION.md #5). Powers both region-select resolution (Workstream
 * B) and progressive-reveal confidence derivation (Workstream A). Frozen
 * set for V0: button, card, input, heading, badge, nav.
 *
 * componentId naming convention: "<family>.<variant>", e.g.
 * "button.primary". Families with only one exemplar still use the dotted
 * form for consistency ("card.default") so region-select and the manifest
 * never need two id shapes.
 */

export interface ComponentManifestEntry {
  componentId: string;
  /** Human label for dev tooling (fixture switcher, inspector panel). */
  label: string;
  /** Dotted token refs this component's rendering depends on, e.g.
   * "color.primary". Order is not meaningful. */
  tokenGroups: string[];
}

export const COMPONENT_MANIFEST: ComponentManifestEntry[] = [
  {
    componentId: "button.primary",
    label: "Primary button",
    tokenGroups: [
      "color.primary",
      "color.onPrimary",
      "shape.radius",
      "typography.label",
      "spacing.inset",
    ],
  },
  {
    componentId: "card.default",
    label: "Card",
    tokenGroups: [
      "color.surface",
      "color.border",
      "shape.radius",
      "elevation.card",
      "spacing.inset",
    ],
  },
  {
    componentId: "input.text",
    label: "Text input",
    tokenGroups: [
      "color.surface",
      "color.border",
      "color.text",
      "shape.radius",
      "typography.body",
      "spacing.inset",
    ],
  },
  {
    componentId: "heading.default",
    label: "Heading",
    tokenGroups: ["color.text", "typography.heading"],
  },
  {
    componentId: "badge.default",
    label: "Badge",
    tokenGroups: [
      "color.accent",
      "color.onAccent",
      "shape.radiusPill",
      "typography.label",
    ],
  },
  {
    componentId: "nav.default",
    label: "Nav bar",
    tokenGroups: [
      "color.surface",
      "color.border",
      "color.text",
      "typography.label",
      "spacing.inset",
    ],
  },
];

export function getManifestEntry(
  componentId: string,
): ComponentManifestEntry | undefined {
  return COMPONENT_MANIFEST.find((e) => e.componentId === componentId);
}

/** Resolves a component's tokensInScope map (dotted ref -> current resolved
 * value) against a token-value lookup — used by Workstream B's region-select
 * handler. Kept here (not in a workstream dir) since both A and B need the
 * exact same lookup semantics. */
export function tokensInScopeFor(
  componentId: string,
  resolve: (dottedRef: string) => string | number | undefined,
): Record<string, string | number> {
  const entry = getManifestEntry(componentId);
  if (!entry) return {};
  const out: Record<string, string | number> = {};
  for (const ref of entry.tokenGroups) {
    const v = resolve(ref);
    if (v !== undefined) out[ref] = v;
  }
  return out;
}
