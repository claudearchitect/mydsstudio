"use client";

import { Session } from "@/shell/Session";
import { renderComponent } from "@/preview/renderComponent";

/**
 * App entry: the full two-pane interaction shell, wired with the real
 * preview renderer so the live preview AND the in-chat proposal picker
 * render the enriched component library (not the Phase-0 placeholder).
 * Session resolves live-vs-demo mode internally (demo is the keyless
 * fallback). The dev FixtureSwitcher (@/preview/FixtureSwitcher) stays
 * available for manually exercising reveal states.
 */
export default function Home() {
  return <Session renderComponent={renderComponent} />;
}
