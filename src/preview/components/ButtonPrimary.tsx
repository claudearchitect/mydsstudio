/**
 * Exemplar component: button.primary. Consumes only `--ds-*` CSS custom
 * properties (V0_PLAN.md Workstream A: "no Tailwind classes inside the
 * preview subtree; no reading `--app-*`"). Falls back to neutral,
 * self-consistent values when a `--ds-*` var is unset (absent group) so
 * the box never renders with browser-default styling (e.g. blue underline
 * links) even before the wrapper's reveal-state handling kicks in.
 */
export function ButtonPrimary() {
  return (
    <button
      type="button"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        cursor: "default",
        background: "var(--ds-color-primary, #9c9a92)",
        color: "var(--ds-color-on-primary, #ffffff)",
        borderRadius: "var(--ds-shape-radius, 6px)",
        padding: "var(--ds-spacing-inset, 12px) calc(var(--ds-spacing-inset, 12px) * 1.5)",
        fontSize: "var(--ds-typography-label, 13px)",
        fontWeight: "var(--ds-typography-label-weight, 500)",
        fontFamily: "inherit",
        lineHeight: 1.2,
      }}
    >
      Book appointment
    </button>
  );
}
