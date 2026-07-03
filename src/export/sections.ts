/**
 * Prose section builders. Each section is synthesized from `rationale`
 * (living claims keyed to dotted token refs) plus the `groups` themselves;
 * `transcript` supplies the Overview's framing and backs up Do's/Don'ts
 * with anything explicitly rejected in conversation. IMPLEMENTATION.md #6 /
 * V0_PLAN.md Workstream D fix the section list and order — see
 * `SECTION_ORDER` in `./types`.
 */
import type { BeliefState, TokenGroupName } from "@/contracts";
import { LOW_CONFIDENCE_THRESHOLD, type SectionName, type Transcript } from "./types";

function ratiFor(state: BeliefState, group: TokenGroupName): string[] {
  const prefix = `${group}.`;
  return state.rationale
    .filter((r) => r.tokens.some((t) => t === group || t.startsWith(prefix)))
    .map((r) => r.claim);
}

function inferredNote(state: BeliefState, group: TokenGroupName): string | null {
  const g = state.groups[group];
  if (!g) return null;
  if (g.confidence < LOW_CONFIDENCE_THRESHOLD) {
    return `_Inferred, not confirmed (confidence ${g.confidence.toFixed(2)})._`;
  }
  return null;
}

function bulletTokens(state: BeliefState, group: TokenGroupName): string[] {
  const g = state.groups[group];
  if (!g) return [];
  return Object.entries(g.tokens).map(
    ([name, tok]) => `- \`${group}.${name}\`: \`${tok.$value}\``,
  );
}

function groupSection(
  state: BeliefState,
  group: TokenGroupName,
  heading: SectionName,
  emptyNote: string,
): string {
  const lines: string[] = [`## ${heading}`, ""];
  const g = state.groups[group];
  if (!g) {
    lines.push(emptyNote);
    return lines.join("\n");
  }

  const note = inferredNote(state, group);
  if (note) lines.push(note, "");

  const claims = ratiFor(state, group);
  if (claims.length > 0) {
    for (const c of claims) lines.push(`- ${c}`);
    lines.push("");
  }

  const tokenBullets = bulletTokens(state, group);
  if (tokenBullets.length > 0) {
    lines.push(...tokenBullets);
  } else {
    lines.push(emptyNote);
  }

  return lines.join("\n");
}

export function buildOverview(state: BeliefState, transcript: Transcript): string {
  const lines = ["## Overview", ""];
  const { product, audience, personality } = state.meta;

  if (product) {
    lines.push(`**Product:** ${product}`);
  }
  if (audience) {
    lines.push(`**Audience:** ${audience}`);
  }
  if (personality.length > 0) {
    lines.push(`**Personality:** ${personality.join(", ")}`);
  }
  if (!product && !audience && personality.length === 0) {
    lines.push("_No product context captured yet._");
  }

  const userLines = transcript.filter((t) => t.speaker === "user").slice(0, 3);
  if (userLines.length > 0) {
    lines.push("", "From the session:", "");
    for (const t of userLines) lines.push(`> ${t.text}`);
  }

  return lines.join("\n");
}

export function buildColors(state: BeliefState): string {
  return groupSection(state, "color", "Colors", "_No color decisions captured yet._");
}

export function buildTypography(state: BeliefState): string {
  return groupSection(
    state,
    "typography",
    "Typography",
    "_No typography decisions captured yet._",
  );
}

export function buildLayout(state: BeliefState): string {
  return groupSection(state, "spacing", "Layout", "_No layout/spacing decisions captured yet._");
}

export function buildElevation(state: BeliefState): string {
  return groupSection(
    state,
    "elevation",
    "Elevation & Depth",
    "_No elevation decisions captured yet._",
  );
}

export function buildShapes(state: BeliefState): string {
  return groupSection(state, "shape", "Shapes", "_No shape decisions captured yet._");
}

export function buildComponents(state: BeliefState): string {
  const lines = ["## Components", ""];
  const touched = (Object.keys(state.groups) as TokenGroupName[]).filter(
    (g) => Object.keys(state.groups[g]?.tokens ?? {}).length > 0,
  );
  if (touched.length === 0) {
    lines.push("_No component-level decisions captured yet._");
    return lines.join("\n");
  }
  lines.push(
    "Exemplar components consume the token groups above; see the front matter for exact values.",
    "",
  );
  for (const g of touched) {
    const conf = state.groups[g]?.confidence ?? 0;
    const marker = conf < LOW_CONFIDENCE_THRESHOLD ? " (inferred, not confirmed)" : "";
    lines.push(`- **${g}**${marker}`);
  }
  return lines.join("\n");
}

export function buildDosAndDonts(state: BeliefState, transcript: Transcript): string {
  const lines = ["## Do's and Don'ts", ""];
  const claims = state.rationale.map((r) => r.claim);
  // Deliberately narrow: cues where the *whole point* of the sentence is a
  // rejection ("not the serif", "no gradients", "avoid X"), not general
  // negation anywhere in an otherwise-affirmative sentence (which would
  // false-positive on e.g. "friendly, not corporate" — a positive pick that
  // happens to contain "not"). A raw-text heuristic can't be perfect; this
  // trades recall for fewer misleading Don'ts.
  const rejectionWords = /\b(never|avoid|instead of|rather than|isn't|reject(ed)?)\b|^\s*not\s|\bnot\s+(the|a|too)\b/i;
  const rejections = transcript
    .filter((t) => t.speaker === "user" && rejectionWords.test(t.text))
    .map((t) => t.text);

  if (claims.length === 0 && rejections.length === 0) {
    lines.push("_No explicit preferences captured yet._");
    return lines.join("\n");
  }

  if (claims.length > 0) {
    lines.push("**Do:**", "");
    for (const c of claims) lines.push(`- ${c}`);
    lines.push("");
  }

  if (rejections.length > 0) {
    lines.push("**Don't:**", "");
    for (const r of rejections) lines.push(`- ${r}`);
  }

  return lines.join("\n").trimEnd();
}
