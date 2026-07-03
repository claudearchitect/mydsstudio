/**
 * Full scripted interview — Workstream B's fake-agent gate fixture
 * (V0_PLAN.md Workstream B: "Extend the fake-agent fixture with a full
 * scripted interview that drives every surface (chat, region, control,
 * propose)"). Extends the fake-agent fixture *contents*, not its format
 * (FakeAgentScript / FakeAgentTurn from ../types) — same shape as
 * dogGroomerOpening.ts, just a longer, more complete session.
 *
 * Turn order (each interaction is what's *live* after that turn's patch
 * applies; the driver advances one FakeAgentTurn per `next()` call):
 *
 *   t00 ask      — kickoff question, empty patch
 *   t01 propose  — color.primary, 2 variants (button.primary)              [chat-driven: reply to t00]
 *   t02 ask      — personality question w/ quick replies                   [chat-driven: variant pick]
 *   t03 propose  — shape.radius, 3 variants (card.default)                 [chat-driven: quick reply]
 *   t04 ask      — open question, acknowledges a REGION comment            [region-driven: pick + region comment both feed chat before this]
 *   t05 propose  — color.accent, 4 variants (badge.default)                [chat-driven]
 *   t06 ask      — acknowledges a CONTROL message (radius stepper nudge)   [control-driven]
 *   t07 ask      — near-complete, final open question                     [chat-driven]
 *
 * This gives the driver walkthrough (used by Session.tsx in dev/demo mode
 * and by the Vitest suite) a scripted turn to react to after each of the
 * four channel-originated messages a manual gate walkthrough will send.
 */
import { EMPTY_TOKEN_PATCH, type TokenPatch } from "@/contracts";
import type { FakeAgentScript } from "../types";

const t01Patch: TokenPatch = {
  ...EMPTY_TOKEN_PATCH,
  meta: { product: "a booking app for dog groomers", audience: "independent grooming businesses" },
  tokens: [{ group: "color", token: "primary", $value: "#5b7f5e", $type: "color" }],
  confidence: [{ group: "color", confidence: 0.15 }],
  rationale: [
    {
      id: "r01",
      claim: "guessed a muted green for primary — pets/grooming often lean natural, unconfirmed",
      tokens: ["color.primary"],
      evidence: ["fake-t01"],
    },
  ],
};

const t02Patch: TokenPatch = {
  ...EMPTY_TOKEN_PATCH,
  tokens: [
    { group: "color", token: "primary", $value: "#5b7f5e", $type: "color" },
    { group: "color", token: "onPrimary", $value: "#ffffff", $type: "color" },
    // Seeded alongside the color confirmation so button.primary's full
    // manifest (color.primary, color.onPrimary, shape.radius,
    // typography.label, spacing.inset) is resolvable early — region-select
    // on the button should report every manifest-declared group, not a
    // partial set, as soon as a reasonable amount of the interview has run.
    { group: "typography", token: "label", $value: "13px/500", $type: "fontSize" },
    { group: "spacing", token: "inset", $value: "8px", $type: "dimension" },
  ],
  confidence: [
    { group: "color", confidence: 0.4 },
    { group: "typography", confidence: 0.15 },
    { group: "spacing", confidence: 0.15 },
  ],
  rationale: [
    {
      id: "r01",
      claim: "confirmed muted green primary — user picked it over a bolder teal",
      tokens: ["color.primary"],
      evidence: ["fake-t01", "fake-t02"],
    },
  ],
};

const t03Patch: TokenPatch = {
  ...EMPTY_TOKEN_PATCH,
  meta: { personality: ["warm", "friendly"] },
  tokens: [
    { group: "color", token: "surface", $value: "#faf9f5", $type: "color" },
    { group: "color", token: "border", $value: "#e2e0d8", $type: "color" },
  ],
  confidence: [{ group: "color", confidence: 0.5 }],
};

const t04Patch: TokenPatch = {
  ...EMPTY_TOKEN_PATCH,
  tokens: [
    { group: "shape", token: "radius", $value: "10px", $type: "dimension" },
    { group: "shape", token: "radiusPill", $value: "9999px", $type: "dimension" },
  ],
  confidence: [{ group: "shape", confidence: 0.55 }],
  rationale: [
    {
      id: "r02",
      claim: "soft-rounded shapes chosen — user said 'friendly, not corporate'",
      tokens: ["shape.radius", "shape.radiusPill"],
      evidence: ["fake-t04"],
    },
  ],
};

const t05Patch: TokenPatch = {
  ...EMPTY_TOKEN_PATCH,
  tokens: [
    { group: "color", token: "text", $value: "#2b2a26", $type: "color" },
  ],
  confidence: [{ group: "color", confidence: 0.6 }],
  rationale: [
    {
      id: "r03",
      claim: "region comment on the primary button ('feels too corporate') — softened toward the warm green, radius already trending rounder",
      tokens: ["color.primary", "shape.radius"],
      evidence: ["fake-t05"],
    },
  ],
};

const t06Patch: TokenPatch = {
  ...EMPTY_TOKEN_PATCH,
  tokens: [
    { group: "color", token: "accent", $value: "#d98a4f", $type: "color" },
    { group: "color", token: "onAccent", $value: "#ffffff", $type: "color" },
  ],
  confidence: [{ group: "color", confidence: 0.65 }],
  rationale: [
    {
      id: "r04",
      claim: "warm terracotta accent for secondary actions, complements the green",
      tokens: ["color.accent"],
      evidence: ["fake-t06"],
    },
  ],
};

const t07Patch: TokenPatch = {
  ...EMPTY_TOKEN_PATCH,
  tokens: [
    // Reflects the stepper nudge from the controls bar (control channel).
    { group: "shape", token: "radius", $value: "14px", $type: "dimension" },
  ],
  confidence: [{ group: "shape", confidence: 0.75 }],
  rationale: [
    {
      id: "r02",
      claim: "user nudged radius rounder via the stepper control — leaning even friendlier than the proposal pick",
      tokens: ["shape.radius"],
      evidence: ["fake-t07"],
    },
  ],
};

const t08Patch: TokenPatch = {
  ...EMPTY_TOKEN_PATCH,
  tokens: [
    { group: "typography", token: "heading", $value: "20px/600", $type: "fontSize" },
    { group: "typography", token: "body", $value: "15px/400", $type: "fontSize" },
    { group: "typography", token: "label", $value: "13px/500", $type: "fontSize" },
  ],
  confidence: [{ group: "typography", confidence: 0.5 }],
};

export const dogGroomerFullInterviewScript: FakeAgentScript = {
  name: "dog-groomer-full-interview",
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
      patch: t01Patch,
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
              tokens: [{ group: "color", token: "primary", $value: "#5b7f5e", $type: "color" }],
            },
          },
          {
            id: "v-teal",
            caption: "Bold teal",
            patch: {
              ...EMPTY_TOKEN_PATCH,
              tokens: [{ group: "color", token: "primary", $value: "#0f766e", $type: "color" }],
            },
          },
        ],
      },
    },
    {
      id: "t02",
      deltaText: "The green it is — warm and trustworthy, noted.",
      patch: t02Patch,
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
    {
      id: "t03",
      deltaText: "Warm and friendly — let's see how rounded things should feel.",
      patch: t03Patch,
      interaction: {
        mode: "propose",
        axis: ["shape.radius"],
        target: "card.default",
        caption: "How rounded should surfaces feel?",
        variants: [
          {
            id: "v-sharp",
            caption: "Sharp",
            patch: {
              ...EMPTY_TOKEN_PATCH,
              tokens: [{ group: "shape", token: "radius", $value: "2px", $type: "dimension" }],
            },
          },
          {
            id: "v-soft",
            caption: "Soft",
            patch: {
              ...EMPTY_TOKEN_PATCH,
              tokens: [{ group: "shape", token: "radius", $value: "10px", $type: "dimension" }],
            },
          },
          {
            id: "v-round",
            caption: "Very round",
            patch: {
              ...EMPTY_TOKEN_PATCH,
              tokens: [{ group: "shape", token: "radius", $value: "20px", $type: "dimension" }],
            },
          },
        ],
      },
    },
    {
      id: "t04",
      deltaText: "The rounder one it is — friendly, not corporate. Noted.",
      patch: t04Patch,
      interaction: {
        mode: "ask",
        question: "Anything about the primary button that feels off, now that you can see it?",
        quickReplies: [],
      },
    },
    {
      id: "t05",
      deltaText: "Understood — that region comment on the button pushed things a bit warmer. Let's pick an accent.",
      patch: t05Patch,
      interaction: {
        mode: "propose",
        axis: ["color.accent"],
        target: "badge.default",
        caption: "Which accent pops without feeling loud?",
        variants: [
          {
            id: "v-orange",
            caption: "Warm orange",
            patch: {
              ...EMPTY_TOKEN_PATCH,
              tokens: [{ group: "color", token: "accent", $value: "#d98a4f", $type: "color" }],
            },
          },
          {
            id: "v-blue",
            caption: "Cool blue",
            patch: {
              ...EMPTY_TOKEN_PATCH,
              tokens: [{ group: "color", token: "accent", $value: "#6b9bd2", $type: "color" }],
            },
          },
          {
            id: "v-pink",
            caption: "Playful pink",
            patch: {
              ...EMPTY_TOKEN_PATCH,
              tokens: [{ group: "color", token: "accent", $value: "#d2708f", $type: "color" }],
            },
          },
          {
            id: "v-yellow",
            caption: "Bright yellow",
            patch: {
              ...EMPTY_TOKEN_PATCH,
              tokens: [{ group: "color", token: "accent", $value: "#d9b13f", $type: "color" }],
            },
          },
        ],
      },
    },
    {
      id: "t06",
      deltaText: "Orange it is — pairs nicely with the green. Feel free to fine-tune anything directly.",
      patch: t06Patch,
      interaction: {
        mode: "ask",
        question: "Feel free to nudge the radius or colors directly if you want to fine-tune.",
        quickReplies: [],
      },
    },
    {
      id: "t07",
      deltaText: "Got it — rounder still. Updated.",
      patch: t07Patch,
      interaction: {
        mode: "ask",
        question: "Last thing — any preference on heading/body type feel (rounded sans vs. serif)?",
        quickReplies: [
          { id: "sans", label: "Rounded sans" },
          { id: "serif", label: "Classic serif" },
        ],
      },
    },
    {
      id: "t08",
      deltaText: "Rounded sans, locking that in. I think we're close to done here.",
      patch: t08Patch,
      interaction: {
        mode: "ask",
        question: "This is feeling solid — anything else you'd like to adjust before we wrap up?",
        quickReplies: [{ id: "done", label: "Looks good, I'm done" }],
      },
    },
  ],
};
