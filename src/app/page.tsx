import { StudioShell } from "@/shell/StudioShell";
import { FixtureSwitcher } from "@/preview/FixtureSwitcher";

/**
 * Phase 0/A wiring note: mounts Workstream A's FixtureSwitcher into the
 * shell's previewSlot so the reveal-state gate is visually checkable in a
 * real browser ahead of Workstream B's real preview-pane chrome (header,
 * controls bar, region-select). B/Phase-2 integration will replace this
 * composition with the full interaction shell; this file is not owned by
 * any single workstream's directory, so keep this wiring minimal.
 */
export default function Home() {
  return <StudioShell previewSlot={<FixtureSwitcher />} />;
}
