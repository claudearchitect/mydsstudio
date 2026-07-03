/**
 * DTCG-style YAML front matter — the machine-readable half of design.md.
 * Reads only `BeliefState.groups` (frozen contract); every emitted token is
 * a direct, lossless copy of a belief-state token ($value/$type/provenance).
 */
import * as yaml from "js-yaml";
import type { BeliefState, TokenGroupName } from "@/contracts";
import { LOW_CONFIDENCE_THRESHOLD } from "./types";

/** Front-matter shape, one entry per present group. Kept close to the DTCG
 * convention: each token keeps `$value`/`$type`; `provenance` rides along
 * since it's cheap and useful for traceability, without inventing new
 * token-level fields the contract doesn't have. */
export interface FrontMatterGroup {
  confidence: number;
  inferred: boolean;
  tokens: Record<string, { $value: string | number; $type: string; provenance: string[] }>;
}

export type FrontMatter = {
  product: string;
  audience: string;
  personality: string[];
  groups: Partial<Record<TokenGroupName, FrontMatterGroup>>;
};

/** Builds the plain-object front matter from belief-state groups. Pure and
 * total over the partial-record shape — absent groups are simply absent. */
export function buildFrontMatter(state: BeliefState): FrontMatter {
  const groups: FrontMatter["groups"] = {};

  for (const [name, group] of Object.entries(state.groups) as [
    TokenGroupName,
    NonNullable<BeliefState["groups"][TokenGroupName]>,
  ][]) {
    const tokens: FrontMatterGroup["tokens"] = {};
    for (const [tokenName, token] of Object.entries(group.tokens)) {
      tokens[tokenName] = {
        $value: token.$value,
        $type: token.$type,
        provenance: token.provenance,
      };
    }
    groups[name] = {
      confidence: group.confidence,
      inferred: group.confidence < LOW_CONFIDENCE_THRESHOLD,
      tokens,
    };
  }

  return {
    product: state.meta.product,
    audience: state.meta.audience,
    personality: state.meta.personality,
    groups,
  };
}

/** Serializes the front matter to a `---`-delimited YAML block. */
export function serializeFrontMatter(state: BeliefState): string {
  const fm = buildFrontMatter(state);
  const body = yaml.dump(fm, { noRefs: true, lineWidth: -1, sortKeys: false });
  return `---\n${body}---\n`;
}

/** Parses a design.md string's front matter back into the plain object
 * `buildFrontMatter` produces. Used by the round-trip test and by the
 * export UI's "view raw" mode if it ever needs to re-derive structure. */
export function parseFrontMatter(designMd: string): FrontMatter {
  const match = designMd.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    throw new Error("design.md: no YAML front matter block found");
  }
  return yaml.load(match[1]) as FrontMatter;
}
