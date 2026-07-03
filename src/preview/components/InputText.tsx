/**
 * Exemplar component: input.text. See ButtonPrimary.tsx for the
 * CSS-vars-only / fallback-values convention shared by every component
 * in this library.
 *
 * Real labeled field: a label row above the input (as a design system's
 * form field would actually be composed), placeholder copy, border/radius
 * from tokens, and a focus ring driven by the same accent color the rest
 * of the system uses — done in plain CSS (`:focus`) via a scoped <style>
 * tag so it reacts to real interaction, not just static chrome.
 */
export function InputText() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "calc(var(--ds-spacing-inset, 12px) * 0.4)",
        width: 220,
        fontFamily: "inherit",
      }}
    >
      <style>{`
        .ds-input-text {
          transition: border-color 120ms ease, box-shadow 120ms ease;
        }
        .ds-input-text:focus {
          border-color: var(--ds-color-primary, #9c9a92);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-color-primary, #9c9a92) 25%, transparent);
        }
      `}</style>
      <label
        htmlFor="ds-input-text-pet-name"
        style={{
          color: "var(--ds-color-text, #2b2a26)",
          fontSize: "var(--ds-typography-label, 12px)",
          fontWeight: "var(--ds-typography-label-weight, 500)",
          lineHeight: 1.2,
        }}
      >
        Pet&rsquo;s name
      </label>
      <input
        id="ds-input-text-pet-name"
        type="text"
        placeholder="e.g. Biscuit"
        className="ds-input-text"
        style={{
          display: "block",
          width: "100%",
          border: "1px solid var(--ds-color-border, #dedcd3)",
          background: "var(--ds-color-surface, #ffffff)",
          color: "var(--ds-color-text, #2b2a26)",
          borderRadius: "var(--ds-shape-radius, 6px)",
          padding: "var(--ds-spacing-inset, 12px)",
          fontSize: "var(--ds-typography-body, 14px)",
          fontWeight: "var(--ds-typography-body-weight, 400)",
          fontFamily: "inherit",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      <span
        style={{
          color: "var(--ds-color-text, #8a887d)",
          fontSize: "var(--ds-typography-label, 11px)",
          opacity: 0.65,
          lineHeight: 1.3,
        }}
      >
        We&rsquo;ll use this to greet your pup at check-in.
      </span>
    </div>
  );
}
