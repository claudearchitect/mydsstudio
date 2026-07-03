/**
 * Exemplar component: badge.default. See ButtonPrimary.tsx for the
 * CSS-vars-only / fallback-values convention shared by every component
 * in this library.
 *
 * Shows a small realistic pair — a status pill (dot + label, the kind a
 * booking list would use for "Available today") and a count-style badge —
 * so "badge" reads as a real product affordance instead of one gray pill.
 */
export function BadgeDefault() {
  return (
    <div
      style={{
        display: "inline-flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "calc(var(--ds-spacing-inset, 12px) * 0.5)",
        fontFamily: "inherit",
        maxWidth: "100%",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "var(--ds-color-accent, #9c9a92)",
          color: "var(--ds-color-on-accent, #ffffff)",
          borderRadius: "var(--ds-shape-radius-pill, 9999px)",
          padding: "5px 12px",
          fontSize: "var(--ds-typography-label, 12px)",
          fontWeight: "var(--ds-typography-label-weight, 500)",
          fontFamily: "inherit",
          lineHeight: 1.2,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "9999px",
            background: "var(--ds-color-on-accent, #ffffff)",
          }}
        />
        Available today
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 18,
          height: 18,
          padding: "0 6px",
          background: "var(--ds-color-surface, #ffffff)",
          color: "var(--ds-color-accent, #9c9a92)",
          border: "1px solid var(--ds-color-border, #dedcd3)",
          borderRadius: "var(--ds-shape-radius-pill, 9999px)",
          fontSize: "calc(var(--ds-typography-label, 12px) * 0.9)",
          fontWeight: "var(--ds-typography-label-weight, 500)",
          fontFamily: "inherit",
          lineHeight: 1,
        }}
      >
        3
      </span>
    </div>
  );
}
