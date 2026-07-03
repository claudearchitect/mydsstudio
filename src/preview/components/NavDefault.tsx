/**
 * Exemplar component: nav.default. See ButtonPrimary.tsx for the
 * CSS-vars-only / fallback-values convention shared by every component
 * in this library.
 *
 * Real top nav bar: a brand mark + wordmark on the left, a few nav links
 * in the middle, and a primary action button on the right — the shape of
 * an actual product header, not three floating labels.
 */
export function NavDefault() {
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--ds-spacing-inset, 12px)",
        width: 320,
        background: "var(--ds-color-surface, #ffffff)",
        border: "1px solid var(--ds-color-border, #dedcd3)",
        borderRadius: "var(--ds-shape-radius, 6px)",
        padding:
          "calc(var(--ds-spacing-inset, 12px) * 0.6) var(--ds-spacing-inset, 12px)",
        color: "var(--ds-color-text, #2b2a26)",
        fontFamily: "inherit",
        boxSizing: "border-box",
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
          alignItems: "center",
          gap: "calc(var(--ds-spacing-inset, 12px) * 0.75)",
        }}
      >
        <span
          style={{
            fontSize: "var(--ds-typography-label, 13px)",
            fontWeight: "var(--ds-typography-label-weight, 500)",
            color: "var(--ds-color-primary, #2b2a26)",
          }}
        >
          Book
        </span>
        <span
          style={{
            fontSize: "var(--ds-typography-label, 13px)",
            fontWeight: "var(--ds-typography-label-weight, 500)",
            opacity: 0.55,
          }}
        >
          Groomers
        </span>
        <span
          style={{
            fontSize: "var(--ds-typography-label, 13px)",
            fontWeight: "var(--ds-typography-label-weight, 500)",
            opacity: 0.55,
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
