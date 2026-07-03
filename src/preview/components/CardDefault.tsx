/**
 * Exemplar component: card.default. See ButtonPrimary.tsx for the
 * CSS-vars-only / fallback-values convention shared by every component
 * in this library.
 *
 * Modeled as a real booking-card surface (groomer profile + book action)
 * rather than gray placeholder bars, so elevation/radius/padding/spacing
 * read as an actual product surface: avatar placeholder, heading, body
 * copy, a meta badge-ish line, and a primary action button anchored to
 * the bottom of the card.
 */
export function CardDefault() {
  return (
    <div
      style={{
        background: "var(--ds-color-surface, #f3f2ee)",
        border: "1px solid var(--ds-color-border, #dedcd3)",
        borderRadius: "var(--ds-shape-radius, 6px)",
        boxShadow: "var(--ds-elevation-card, 0 1px 2px rgba(0,0,0,0.08))",
        padding: "var(--ds-spacing-inset, 12px)",
        width: 240,
        display: "flex",
        flexDirection: "column",
        gap: "calc(var(--ds-spacing-inset, 12px) * 0.75)",
        fontFamily: "inherit",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "calc(var(--ds-spacing-inset, 12px) * 0.6)",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: "var(--ds-shape-radius, 6px)",
            background:
              "linear-gradient(135deg, var(--ds-color-primary, #9c9a92), var(--ds-color-accent, #c9c7bc))",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span
            style={{
              color: "var(--ds-color-text, #2b2a26)",
              fontSize: "var(--ds-typography-heading, 16px)",
              fontWeight: "var(--ds-typography-heading-weight, 600)",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Maple &amp; Co. Grooming
          </span>
          <span
            style={{
              color: "var(--ds-color-accent, #9c9a92)",
              fontSize: "var(--ds-typography-label, 12px)",
              fontWeight: "var(--ds-typography-label-weight, 500)",
              lineHeight: 1.2,
            }}
          >
            Open today · 9am–5pm
          </span>
        </div>
      </div>

      <p
        style={{
          margin: 0,
          color: "var(--ds-color-text, #4a483f)",
          fontSize: "var(--ds-typography-body, 13px)",
          fontWeight: "var(--ds-typography-body-weight, 400)",
          lineHeight: 1.45,
          opacity: 0.85,
        }}
      >
        Full-service grooming for dogs of every size — bath, trim, and nail
        care from groomers your pup already knows.
      </p>

      <button
        type="button"
        style={{
          alignSelf: "flex-start",
          marginTop: "calc(var(--ds-spacing-inset, 12px) * 0.25)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          cursor: "pointer",
          background: "var(--ds-color-primary, #9c9a92)",
          color: "var(--ds-color-on-primary, #ffffff)",
          borderRadius: "var(--ds-shape-radius, 6px)",
          padding:
            "calc(var(--ds-spacing-inset, 12px) * 0.5) calc(var(--ds-spacing-inset, 12px) * 1.1)",
          fontSize: "var(--ds-typography-label, 12px)",
          fontWeight: "var(--ds-typography-label-weight, 500)",
          fontFamily: "inherit",
          lineHeight: 1.2,
        }}
      >
        Book appointment
      </button>
    </div>
  );
}
