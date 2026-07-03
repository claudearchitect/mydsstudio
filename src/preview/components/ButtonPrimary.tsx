/**
 * Exemplar component: button.primary. Consumes only `--ds-*` CSS custom
 * properties (V0_PLAN.md Workstream A: "no Tailwind classes inside the
 * preview subtree; no reading `--app-*`"). Falls back to neutral,
 * self-consistent values when a `--ds-*` var is unset (absent group) so
 * the box never renders with browser-default styling (e.g. blue underline
 * links) even before the wrapper's reveal-state handling kicks in.
 *
 * Shows a primary + secondary pair (real button chrome: padding, radius,
 * hover/active affordance via CSS custom-state, real labels) so a single
 * manifest entry ("button.primary") still reads as a small button group —
 * the way a real design system's button page would show variants side by
 * side — rather than one lonely rectangle. Hover/active affordance is done
 * with plain CSS via a scoped <style> tag (no Tailwind, no JS state) so it
 * still behaves at compact proposal-picker size.
 */
export function ButtonPrimary() {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "calc(var(--ds-spacing-inset, 12px) * 0.6)",
        fontFamily: "inherit",
      }}
    >
      <style>{`
        .ds-btn-primary {
          transition: filter 120ms ease, transform 120ms ease;
        }
        .ds-btn-primary:hover { filter: brightness(0.94); }
        .ds-btn-primary:active { filter: brightness(0.88); transform: translateY(1px); }
        .ds-btn-secondary {
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
          background: "transparent",
          color: "var(--ds-color-primary, #6b6a63)",
          border: "1px solid var(--ds-color-border, #dedcd3)",
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
