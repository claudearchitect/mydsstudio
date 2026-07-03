/**
 * Dotted token-reference helpers: "group.token" <-> { group, token }.
 * Used by the component manifest, TokenPatch ops, rationale.tokens, and
 * region-select tokens_in_scope — anywhere a token needs a single string key.
 */
import { TokenGroupNameSchema, type TokenGroupName } from "./beliefState";

export interface TokenRef {
  group: TokenGroupName;
  token: string;
}

export function parseTokenRef(ref: string): TokenRef {
  const idx = ref.indexOf(".");
  if (idx === -1) {
    throw new Error(`Invalid token ref "${ref}": expected "group.token"`);
  }
  const group = ref.slice(0, idx);
  const token = ref.slice(idx + 1);
  const parsed = TokenGroupNameSchema.safeParse(group);
  if (!parsed.success) {
    throw new Error(`Invalid token ref "${ref}": unknown group "${group}"`);
  }
  if (!token) {
    throw new Error(`Invalid token ref "${ref}": missing token name`);
  }
  return { group: parsed.data, token };
}

export function formatTokenRef(group: TokenGroupName, token: string): string {
  return `${group}.${token}`;
}
