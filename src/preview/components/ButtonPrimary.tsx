/**
 * Exemplar component: button.primary. Consumes only `--ds-*` CSS custom
 * properties (V0_PLAN.md Workstream A: "no Tailwind classes inside the
 * preview subtree; no reading `--app-*`"). Falls back to neutral,
 * self-consistent values when a `--ds-*` var is unset (absent group) so
 * the box never renders with browser-default styling (e.g. blue underline
 * links) even before the wrapper's reveal-state handling kicks in.
 *
 * Shows a primary + secondary pair (real button chrome: padding, radius,
 * hover/active affordance, real labels) so a single manifest entry
 * ("button.primary") still reads as a small button group — the way a real
 * design system's button page would show variants side by side — rather
 * than one lonely rectangle. Hover/active affordance is plain CSS via a
 * scoped <style> tag (no Tailwind, no JS state) so it still behaves at
 * compact proposal-picker size. Properties a hover/active rule needs to
 * override (border, background) are set in the stylesheet rather than
 * inline — an inline style always wins the cascade over a class selector
 * regardless of pseudo-class, so putting them inline would make the
 * hover rule dead code.
 *
 * Wraps (`flexWrap: wrap`) rather than forcing both buttons onto one row —
 * the proposal picker renders this same component inside a ~180px compact
 * card, and a wrapped secondary button still reads fine there instead of
 * overflowing the card bounds.
 */
export function ButtonPrimary() {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "calc(var(--ds-spacing-inset, 12px) * 0.6)",
        fontFamily: "inherit",
        maxWidth: "100%",
      }}
    >
      <style>{`
        .ds-btn-primary {
          transition: filter 120ms ease, transform 120ms ease;
        }
        .ds-btn-primary:hover { filter: brightness(0.94); }
        .ds-btn-primary:active { filter: brightness(0.88); transform: translateY(1px); }
        .ds-btn-secondary {
          background: transparent;
          border: 1px solid var(--ds-color-border, #dedcd3);
          transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
        }
        .ds-btn-secondary:hover {
          background: var(--ds-color-surface, #f3f2ee);
          border-color: var(--ds-color-primary, #5b7f5e);
        }
        .ds-btn-secondary:active { transform: translateY(1px); }
      `}</style>
      <button
        type="button"
        className="ds-btn-primary"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          cursor: "pointer",
          background: "var(--ds-color-primary, #9c9a92)",
          color: "var(--ds-color-on-primary, #ffffff)",
          borderRadius: "var(--ds-shape-radius, 6px)",
          padding:
            "var(--ds-spacing-inset, 12px) calc(var(--ds-spacing-inset, 12px) * 1.5)",
          fontSize: "var(--ds-typography-label, 13px)",
          fontWeight: "var(--ds-typography-label-weight, 500)",
          fontFamily: "inherit",
          lineHeight: 1.2,
          boxShadow: "var(--ds-elevation-card, none)",
        }}
      >
        Book appointment
      </button>
      <button
        type="button"
        className="ds-btn-secondary"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "var(--ds-color-primary, #6b6a63)",
          borderRadius: "var(--ds-shape-radius, 6px)",
          padding:
            "var(--ds-spacing-inset, 12px) calc(var(--ds-spacing-inset, 12px) * 1.5)",
          fontSize: "var(--ds-typography-label, 13px)",
          fontWeight: "var(--ds-typography-label-weight, 500)",
          fontFamily: "inherit",
          lineHeight: 1.2,
        }}
      >
        See pricing
      </button>
    </div>
  );
}
