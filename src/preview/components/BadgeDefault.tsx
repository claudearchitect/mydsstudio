/**
 * Exemplar component: badge.default. See ButtonPrimary.tsx for the
 * CSS-vars-only / fallback-values convention shared by every component
 * in this library.
 */
export function BadgeDefault() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--ds-color-accent, #9c9a92)",
        color: "var(--ds-color-on-accent, #ffffff)",
        borderRadius: "var(--ds-shape-radius-pill, 9999px)",
        padding: "4px 10px",
        fontSize: "var(--ds-typography-label, 12px)",
        fontWeight: "var(--ds-typography-label-weight, 500)",
        fontFamily: "inherit",
        lineHeight: 1.2,
      }}
    >
      New
    </span>
  );
}
