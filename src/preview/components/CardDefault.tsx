/**
 * Exemplar component: card.default. See ButtonPrimary.tsx for the
 * CSS-vars-only / fallback-values convention shared by every component
 * in this library.
 */
export function CardDefault() {
  return (
    <div
      style={{
        background: "var(--ds-color-surface, #f3f2ee)",
        border: "1px solid var(--ds-color-border, #dedcd3)",
        borderRadius: "var(--ds-shape-radius, 6px)",
        boxShadow: "var(--ds-elevation-card, none)",
        padding: "var(--ds-spacing-inset, 12px)",
        width: 220,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          width: "60%",
          height: 10,
          borderRadius: 3,
          background: "var(--ds-color-border, #dedcd3)",
        }}
      />
      <div
        style={{
          width: "90%",
          height: 8,
          borderRadius: 3,
          background: "var(--ds-color-border, #dedcd3)",
          opacity: 0.7,
        }}
      />
      <div
        style={{
          width: "75%",
          height: 8,
          borderRadius: 3,
          background: "var(--ds-color-border, #dedcd3)",
          opacity: 0.7,
        }}
      />
    </div>
  );
}
