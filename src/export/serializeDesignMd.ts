/**
 * `serializeDesignMd` — Workstream D's sole export surface
 * (V0_PLAN.md "Workstream D — design.md export", IMPLEMENTATION.md #6).
 * Pure serialization: no mutation, no network, no randomness. Reads only
 * `BeliefState` (frozen contract) and the local `Transcript` projection.
 */
import type { BeliefState } from "@/contracts";
import { serializeFrontMatter } from "./frontMatter";
import {
  buildColors,
  buildComponents,
  buildDosAndDonts,
  buildElevation,
  buildLayout,
  buildOverview,
  buildShapes,
  buildTypography,
} from "./sections";
import type { Transcript } from "./types";

/**
 * Serializes a belief state (+ optional transcript) into a design.md
 * document: DTCG-style YAML front matter followed by prose sections in the
 * canonical order (Overview, Colors, Typography, Layout, Elevation & Depth,
 * Shapes, Components, Do's and Don'ts). Groups absent from the belief state
 * render an explicit "not captured yet" note rather than being omitted
 * silently, so a partial export is always structurally complete. Groups
 * below `LOW_CONFIDENCE_THRESHOLD` are marked "inferred, not confirmed" both
 * in the front matter (`inferred: true`) and in prose.
 */
export function serializeDesignMd(state: BeliefState, transcript: Transcript = []): string {
  const frontMatter = serializeFrontMatter(state);

  const sections = [
    buildOverview(state, transcript),
    buildColors(state),
    buildTypography(state),
    buildLayout(state),
    buildElevation(state),
    buildShapes(state),
    buildComponents(state),
    buildDosAndDonts(state, transcript),
  ];

  return `${frontMatter}\n${sections.join("\n\n")}\n`;
}
