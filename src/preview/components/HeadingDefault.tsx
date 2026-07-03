/**
 * Exemplar component: heading.default. See ButtonPrimary.tsx for the
 * CSS-vars-only / fallback-values convention shared by every component
 * in this library.
 */
export function HeadingDefault() {
  return (
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
  );
}
