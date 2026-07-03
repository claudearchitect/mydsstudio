/**
 * Workstream D-local types. These are NOT frozen contracts (not in
 * `src/contracts/`) — they exist only to shape `serializeDesignMd`'s inputs
 * and are free to evolve within this directory.
 *
 * `TranscriptEntry` is a light projection of the conversational parts of
 * `BeliefState.events` (session_start / message / interact payloads carry
 * enough to reconstruct this) plus optional attribution. `serializeDesignMd`
 * accepts it as an explicit second argument per V0_PLAN.md's
 * `serializeDesignMd(state, transcript) → string` signature, decoupling the
 * exporter from the exact shape of `BeliefEvent.payload` (which is `unknown`
 * at the contract layer).
 */

/** One line of the human-readable conversation, in chronological order. */
export interface TranscriptEntry {
  /** Who said it. "agent" covers both `ask` questions and `propose` captions. */
  speaker: "user" | "agent";
  text: string;
}

export type Transcript = TranscriptEntry[];

/** Confidence at/above this is treated as confirmed for export purposes;
 * below it, the group's tokens are still exported (partial-export is
 * additive, never lossy) but flagged as inferred. This is an export-only
 * concern — distinct from Workstream A's reveal-state thresholds, which
 * govern preview blur, not document semantics. */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

/** Canonical design.md section order (IMPLEMENTATION.md #6, V0_PLAN.md
 * Workstream D). Frozen within this module — tests assert against it. */
export const SECTION_ORDER = [
  "Overview",
  "Colors",
  "Typography",
  "Layout",
  "Elevation & Depth",
  "Shapes",
  "Components",
  "Do's and Don'ts",
] as const;

export type SectionName = (typeof SECTION_ORDER)[number];
