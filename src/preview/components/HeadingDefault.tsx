/**
 * Exemplar component: heading.default. See ButtonPrimary.tsx for the
 * CSS-vars-only / fallback-values convention shared by every component
 * in this library.
 *
 * Rendered as a real type specimen: the heading plus a supporting body
 * line underneath (set in the body token, not the heading token) so the
 * type pairing is visible at a glance, the way a type-scale page in an
 * actual design system would show a headline with deck copy beneath it.
 */
export function HeadingDefault() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "calc(var(--ds-spacing-inset, 12px) * 0.4)",
        maxWidth: 280,
        fontFamily: "inherit",
      }}
    >
      <h2
        style={{
          margin: 0,
          color: "var(--ds-color-text, #2b2a26)",
          fontSize: "var(--ds-typography-heading, 20px)",
          fontWeight: "var(--ds-typography-heading-weight, 600)",
          fontFamily: "inherit",
          lineHeight: 1.25,
        }}
      >
        Book your groomer
      </h2>
      <p
        style={{
          margin: 0,
          color: "var(--ds-color-text, #4a483f)",
          fontSize: "var(--ds-typography-body, 14px)",
          fontWeight: "var(--ds-typography-body-weight, 400)",
          fontFamily: "inherit",
          lineHeight: 1.45,
          opacity: 0.8,
        }}
      >
        Same-day appointments with groomers your dog already trusts.
      </p>
    </div>
  );
}
