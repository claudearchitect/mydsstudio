/**
 * A short scripted interview opening: kickoff ask -> semantic answer
 * produces a patch + a propose interaction with 2 variants -> pick applies
 * one variant's patch. Exercises both interaction modes and a non-empty
 * TokenPatch, per V0_PLAN.md's fake-agent fixture requirement.
 *
 * This is intentionally small (3 turns). Workstream B extends this fixture
 * set with "a full scripted interview to drive every surface" per its own
 * checklist item — this file stays as the Phase-0-frozen minimal example.
 */
import { EMPTY_TOKEN_PATCH, type TokenPatch } from "@/contracts";
import type { FakeAgentScript } from "../types";

const patchWithColorGuess: TokenPatch = {
  ...EMPTY_TOKEN_PATCH,
  meta: { product: "a booking app for dog groomers" },
  tokens: [
    { group: "color", token: "primary", $value: "#5b7f5e", $type: "color" },
  ],
  confidence: [{ group: "color", confidence: 0.1 }],
  rationale: [
    {
      id: "r01",
      claim: "guessed a muted green for primary — pets/grooming often lean natural, unconfirmed",
      tokens: ["color.primary"],
      evidence: ["fake-t01"],
    },
  ],
};

export const dogGroomerOpeningScript: FakeAgentScript = {
  name: "dog-groomer-opening",
  turns: [
    {
      id: "t00",
      deltaText: "Let's start simple — what are you building, and who's it for?",
      patch: EMPTY_TOKEN_PATCH,
      interaction: {
        mode: "ask",
        question: "What are you building, and who's it for?",
        quickReplies: [],
      },
    },
    {
      id: "t01",
      deltaText: "Got it — a booking app for dog groomers. Let's start narrowing the palette.",
      patch: patchWithColorGuess,
      interaction: {
        mode: "propose",
        axis: ["color.primary"],
        target: "button.primary",
        caption: "Which primary color feels closer to right?",
        variants: [
          {
            id: "v-green",
            caption: "Muted green",
            patch: {
              ...EMPTY_TOKEN_PATCH,
              tokens: [
                { group: "color", token: "primary", $value: "#5b7f5e", $type: "color" },
              ],
            },
          },
          {
            id: "v-teal",
            caption: "Bold teal",
            patch: {
              ...EMPTY_TOKEN_PATCH,
              tokens: [
                { group: "color", token: "primary", $value: "#0f766e", $type: "color" },
              ],
            },
          },
        ],
      },
    },
    {
      id: "t02",
      deltaText: "The green it is — warm and trustworthy, noted.",
      patch: {
        ...EMPTY_TOKEN_PATCH,
        tokens: [
          { group: "color", token: "primary", $value: "#5b7f5e", $type: "color" },
          { group: "color", token: "onPrimary", $value: "#ffffff", $type: "color" },
        ],
        confidence: [{ group: "color", confidence: 0.45 }],
        rationale: [
          {
            id: "r01",
            claim: "confirmed muted green primary — user picked it over a bolder teal",
            tokens: ["color.primary"],
            evidence: ["fake-t01", "fake-t02"],
          },
        ],
      },
      interaction: {
        mode: "ask",
        question: "How would you describe the personality you want — a few words is plenty.",
        quickReplies: [
          { id: "warm", label: "Warm & friendly" },
          { id: "professional", label: "Clean & professional" },
          { id: "playful", label: "Playful & fun" },
        ],
      },
    },
  ],
};
