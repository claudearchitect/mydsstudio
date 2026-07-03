import { Session } from "@/shell/Session";

/**
 * App entry: Workstream B's full two-pane interaction shell.
 *
 * In this phase Session is driven by the fake-agent turn adapter; Phase 2
 * wires it to Workstream C's /api/turn and mounts Workstream A's PreviewPanel
 * into the preview slot. Workstream A's dev FixtureSwitcher (@/preview/
 * FixtureSwitcher) stays available for manually exercising reveal states.
 */
export default function Home() {
  return <Session />;
}
