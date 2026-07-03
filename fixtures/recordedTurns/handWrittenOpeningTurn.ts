/**
 * Hand-written recorded-response fixture (V0_PLAN.md gate item, "no API key
 * available" section: "Provide at least one HAND-WRITTEN recorded-response
 * fixture ... so your unit tests for patch application are real").
 *
 * This is NOT captured from a live call (no ANTHROPIC_API_KEY is available
 * in this environment) — it's a plausible `{update_beliefs, interact}`
 * tool-use response, hand-authored to match exactly what
 * `validateTurnToolCalls` and `applyPatch` expect: two `tool_use` content
 * blocks (`update_beliefs` then `interact`), each with a `.input` that is
 * already a parsed object (never a JSON string) — mirroring what the SDK's
 * `finalMessage().content` actually contains.
 *
 * Once a real ANTHROPIC_API_KEY exists, replace/extend this with fixtures
 * recorded via the CLI harness's `--record` flag (see src/server/README.md)
 * without changing this file's shape.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { TOOL_NAMES, type TokenPatch, type Interaction } from "@/contracts";

export const handWrittenOpeningPatch: TokenPatch = {
  meta: {
    product: "a booking app for dog groomers",
    audience: "independent pet groomers and the pet owners who book with them",
    personality: ["warm", "trustworthy"],
  },
  tokens: [
    { group: "color", token: "primary", $value: "#5b7f5e", $type: "color" },
  ],
  confidence: [{ group: "color", confidence: 0.15 }],
  rationale: [
    {
      id: "r01",
      claim:
        "seeded a muted, natural green for primary — unconfirmed guess based on the pet/grooming domain, not yet validated with the user",
      tokens: ["color.primary"],
      evidence: ["e01"],
    },
  ],
};

export const handWrittenOpeningInteraction: Interaction = {
  mode: "ask",
  question: "What's the personality you're going for — a few words is plenty?",
  quickReplies: [
    { id: "warm", label: "Warm & friendly" },
    { id: "professional", label: "Clean & professional" },
    { id: "playful", label: "Playful & fun" },
  ],
};

/**
 * The full content array as it would appear on `finalMessage().content`
 * after a successful (protocol-satisfying) turn: a thinking block (typical
 * of adaptive thinking with `display: "omitted"` — empty text, per the
 * claude-api skill), a text block (the streamed NL preamble, if any), and
 * the two required tool_use blocks in order.
 */
export const handWrittenOpeningContent: Anthropic.ContentBlock[] = [
  {
    type: "thinking",
    thinking: "",
    signature: "fixture-signature-not-a-real-thinking-block",
  },
  {
    type: "tool_use",
    id: "toolu_fixture_update_beliefs_01",
    name: TOOL_NAMES.updateBeliefs,
    input: { patch: handWrittenOpeningPatch },
    caller: { type: "direct" },
  },
  {
    type: "tool_use",
    id: "toolu_fixture_interact_01",
    name: TOOL_NAMES.interact,
    input: handWrittenOpeningInteraction,
    caller: { type: "direct" },
  },
];

/** A representative `usage` block, shaped like what a turn-2+ response
 * would report once prompt caching is warm (cache_read_input_tokens > 0).
 * Values are plausible, not measured — no live call has run in this
 * environment. */
export const handWrittenOpeningUsage: Anthropic.Usage = {
  input_tokens: 412,
  output_tokens: 187,
  cache_creation_input_tokens: 0,
  cache_creation: null,
  cache_read_input_tokens: 3184,
  inference_geo: null,
  output_tokens_details: null,
  server_tool_use: null,
  service_tier: "standard",
};
