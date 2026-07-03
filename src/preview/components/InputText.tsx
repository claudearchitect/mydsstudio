/**
 * Exemplar component: input.text. See ButtonPrimary.tsx for the
 * CSS-vars-only / fallback-values convention shared by every component
 * in this library.
 */
export function InputText() {
  return (
    <input
      type="text"
      readOnly
      placeholder="Pet's name"
      style={{
        display: "block",
        width: 220,
        border: "1px solid var(--ds-color-border, #dedcd3)",
        background: "var(--ds-color-surface, #ffffff)",
        color: "var(--ds-color-text, #2b2a26)",
        borderRadius: "var(--ds-shape-radius, 6px)",
        padding: "var(--ds-spacing-inset, 12px)",
        fontSize: "var(--ds-typography-body, 14px)",
        fontWeight: "var(--ds-typography-body-weight, 400)",
        fontFamily: "inherit",
        outline: "none",
      }}
    />
  );
}
