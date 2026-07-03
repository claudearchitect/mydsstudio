/**
 * A tiny scripted interview for driving the CLI harness's `--mock` mode
 * end-to-end with no ANTHROPIC_API_KEY and no network calls (V0_PLAN.md
 * gate: "CLI harness runs and, with a mock client, plays a scripted turn
 * end-to-end and dumps belief state").
 *
 * Run:
 *   npm run cli -- --mock fixtures/recordedTurns/cliScripts/twoTurnDemo --max-turns 2
 *
 * Two turns: kickoff -> ask, then a color proposal after the user answers.
 * Exported as `script`, an array of ScriptedResponse consumed in order by
 * src/server/testUtils/mockAnthropicClient.ts.
 */
import type { ScriptedResponse } from "@/server/testUtils/mockAnthropicClient";
import { buildMockMessage } from "@/server/testUtils/buildMockMessage";
import { TOOL_NAMES, EMPTY_TOKEN_PATCH } from "@/contracts";

export const script: ScriptedResponse[] = [
  {
    kind: "message",
    deltaTexts: ["Let's start simple — ", "what are you building, and who's it for?"],
    message: buildMockMessage({
      content: [
        {
          type: "tool_use" as const,
          caller: { type: "direct" as const },
          id: "toolu_demo_ub_01",
          name: TOOL_NAMES.updateBeliefs,
          input: { patch: EMPTY_TOKEN_PATCH },
        },
        {
          type: "tool_use" as const,
          caller: { type: "direct" as const },
          id: "toolu_demo_ia_01",
          name: TOOL_NAMES.interact,
          input: {
            mode: "ask",
            question: "What are you building, and who's it for?",
            quickReplies: [],
          },
        },
      ],
      usage: { cache_read_input_tokens: 0, cache_creation_input_tokens: 1200 },
    }),
  },
  {
    kind: "message",
    deltaTexts: ["Got it — let's narrow the palette."],
    message: buildMockMessage({
      content: [
        {
          type: "tool_use" as const,
          caller: { type: "direct" as const },
          id: "toolu_demo_ub_02",
          name: TOOL_NAMES.updateBeliefs,
          input: {
            patch: {
              meta: { product: "a booking app for dog groomers", audience: "", personality: [] },
              tokens: [{ group: "color", token: "primary", $value: "#5b7f5e", $type: "color" }],
              confidence: [{ group: "color", confidence: 0.15 }],
              rationale: [
                {
                  id: "r01",
                  claim: "seeded a muted green guess for primary — unconfirmed",
                  tokens: ["color.primary"],
                  evidence: ["e01"],
                },
              ],
            },
          },
        },
        {
          type: "tool_use" as const,
          caller: { type: "direct" as const },
          id: "toolu_demo_ia_02",
          name: TOOL_NAMES.interact,
          input: {
            mode: "propose",
            axis: ["color.primary"],
            target: "button.primary",
            caption: "Which primary color feels closer to right?",
            variants: [
              {
                id: "v-green",
                caption: "Muted green",
                patch: { ...EMPTY_TOKEN_PATCH, tokens: [{ group: "color", token: "primary", $value: "#5b7f5e", $type: "color" }] },
              },
              {
                id: "v-teal",
                caption: "Bold teal",
                patch: { ...EMPTY_TOKEN_PATCH, tokens: [{ group: "color", token: "primary", $value: "#0f766e", $type: "color" }] },
              },
            ],
          },
        },
      ],
      usage: { cache_read_input_tokens: 3184, cache_creation_input_tokens: 0 },
    }),
  },
];
