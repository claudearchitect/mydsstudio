/**
 * Exemplar component: nav.default. See ButtonPrimary.tsx for the
 * CSS-vars-only / fallback-values convention shared by every component
 * in this library.
 */
export function NavDefault() {
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--ds-spacing-inset, 12px)",
        width: 260,
        background: "var(--ds-color-surface, #ffffff)",
        border: "1px solid var(--ds-color-border, #dedcd3)",
        padding: "var(--ds-spacing-inset, 12px)",
        color: "var(--ds-color-text, #2b2a26)",
        fontSize: "var(--ds-typography-label, 13px)",
        fontWeight: "var(--ds-typography-label-weight, 500)",
        fontFamily: "inherit",
      }}
    >
      <span>Book</span>
      <span style={{ opacity: 0.6 }}>Groomers</span>
      <span style={{ opacity: 0.6 }}>Account</span>
    </nav>
  );
}
