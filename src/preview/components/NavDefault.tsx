/**
 * Exemplar component: nav.default. See ButtonPrimary.tsx for the
 * CSS-vars-only / fallback-values convention shared by every component
 * in this library.
 *
 * Real top nav bar: a brand mark + wordmark on the left, a few nav links
 * in the middle, and a primary action button on the right — the shape of
 * an actual product header, not three floating labels. `flexWrap: wrap`
 * plus `maxWidth: 100%` let the link cluster drop to a second row instead
 * of overflowing when this renders inside the proposal picker's ~180px
 * compact card — the full nav bar shows in the main preview panel where
 * there's room, and still reads as a real nav (not clipped) at small size.
 */
export function NavDefault() {
  return (
    <nav
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        rowGap: "calc(var(--ds-spacing-inset, 12px) * 0.5)",
        columnGap: "var(--ds-spacing-inset, 12px)",
        width: "min(320px, 100%)",
        boxSizing: "border-box",
        background: "var(--ds-color-surface, #ffffff)",
        border: "1px solid var(--ds-color-border, #dedcd3)",
        borderRadius: "var(--ds-shape-radius, 6px)",
        padding:
          "calc(var(--ds-spacing-inset, 12px) * 0.6) var(--ds-spacing-inset, 12px)",
        color: "var(--ds-color-text, #2b2a26)",
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 20,
            height: 20,
            flexShrink: 0,
            borderRadius: "var(--ds-shape-radius, 6px)",
            background: "var(--ds-color-primary, #9c9a92)",
          }}
        />
        <span
          style={{
            fontSize: "var(--ds-typography-heading, 15px)",
            fontWeight: "var(--ds-typography-heading-weight, 600)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          Maple &amp; Co.
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "calc(var(--ds-spacing-inset, 12px) * 0.75)",
        }}
      >
        <span
          style={{
            fontSize: "var(--ds-typography-label, 13px)",
            fontWeight: "var(--ds-typography-label-weight, 500)",
            color: "var(--ds-color-primary, #2b2a26)",
            whiteSpace: "nowrap",
          }}
        >
          Book
        </span>
        <span
          style={{
            fontSize: "var(--ds-typography-label, 13px)",
            fontWeight: "var(--ds-typography-label-weight, 500)",
            opacity: 0.55,
            whiteSpace: "nowrap",
          }}
        >
          Groomers
        </span>
        <span
          style={{
            fontSize: "var(--ds-typography-label, 13px)",
            fontWeight: "var(--ds-typography-label-weight, 500)",
            opacity: 0.55,
            whiteSpace: "nowrap",
          }}
        >
          Account
        </span>
      </div>

      <button
        type="button"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          cursor: "pointer",
          flexShrink: 0,
          background: "var(--ds-color-primary, #9c9a92)",
          color: "var(--ds-color-on-primary, #ffffff)",
          borderRadius: "var(--ds-shape-radius, 6px)",
          padding:
            "calc(var(--ds-spacing-inset, 12px) * 0.4) calc(var(--ds-spacing-inset, 12px) * 0.9)",
          fontSize: "calc(var(--ds-typography-label, 13px) * 0.9)",
          fontWeight: "var(--ds-typography-label-weight, 500)",
          fontFamily: "inherit",
          lineHeight: 1.2,
        }}
      >
        Sign in
      </button>
    </nav>
  );
}
