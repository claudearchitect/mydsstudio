# Implementation architecture

Companion to [CONCEPT.md](CONCEPT.md). This documents the settled architecture for the AI design-system interview. See [V0_PLAN.md](V0_PLAN.md) for the build plan.

## 1. Core commitment: single shared artifact, single writer

The system is built around one structured document — the **belief state** — and one rule: **only the model writes to it.**

- The **agent** never generates UI. Its only write path is a structured tool call that patches the belief state.
- The **renderer** never holds state. It deterministically projects belief state → CSS custom properties → a fixed library of exemplar components.
- The **user** never edits the schema. Every user action — chat reply, option pick, region comment, control tweak — normalizes into a *message to the model*. The model decides what (if anything) changes.

The loop:

```
agent turn ──belief patch──▶ shared artifact ──deterministic render──▶ visualizer
    ▲                                                                      │
    └───────────────── events (chat / region / control) ◀─── user acts ───┘
```

Everyone speaks two currencies: **token patches** (writes, model-only) and **events/messages** (inputs, user-originated).

## 2. The belief state

A small JSON document (a few KB) — the single source of truth for the whole session, and already proto-design.md in shape:

```jsonc
{
  "meta": { "product": "...", "audience": "...", "personality": ["..."] },
  "groups": {
    "color":  { "confidence": 0.35, "tokens": {
      "primary": { "$value": "#1d4ed8", "$type": "color", "provenance": ["e07", "e12"] }
    }},
    "shape":  { "confidence": 0.72, "tokens": { /* ... */ } },
    "type":   { "confidence": 0.20, "tokens": { /* ... */ } }
  },
  "rationale": [
    { "id": "r03",
      "claim": "soft radii, generous spacing — chose rounded twice, said 'friendly, not childish'",
      "tokens": ["shape.radius", "spacing.inset"],
      "evidence": ["e07", "e09"] }
  ],
  "events": [ /* append-only log of every user input and model action */ ]
}
```

Parameter groups (the latent space): color, typography, spacing/density, shape (radius), elevation/depth, contrast, motion, voice/tone. Tokens follow DTCG conventions (`$value`, `$type`) so export is a serialization, not a translation.

### Confidence

**Fully model-controlled.** The model assigns it, updates it, and consumes it (for question targeting). The client only reads it, to derive reveal states. No client-side rubric or computation. The system prompt must define what the scale means (what warrants 0.9 vs 0.4) so the numbers stay calibrated — that is prompt design, not architecture.

### Rationale

A small set of **living claims** (not an append-only reasoning log), keyed to the tokens they justify, with evidence pointers into the event log. When a belief flips, the claim is *replaced* — the event log keeps history. Expected size: 10–20 one-line claims.

Why persist it (each of these fails without it):

1. **Session memory.** The transcript tail falls out of context in long sessions; the belief state persists in full. Rationale is the only place that records *why* a value is what it is — confidence is magnitude, rationale is content.
2. **Contradiction quality.** Good clarifying questions ("earlier you leaned friendly and rounded — is this shift a change of direction?") can only be generated from persisted reasons, not persisted values.
3. **Confidence calibration.** Requiring a claim alongside every patch is the show-your-work forcing function that keeps fully-model-controlled confidence from drifting into noise.
4. **The design.md prose layer.** Captured turn-by-turn while evidence is fresh, export becomes assembly instead of end-of-session archaeology.

Bonus: the visualizer can surface claims on tap ("rounded because you said friendly, not childish") — trust-building, and itself a correction surface.

## 3. The agent

A **single interviewer agent** (Claude API). It chooses each turn whether to ask or propose. Each turn is stateless from the model's perspective; the server assembles:

1. **System prompt** — role, parameter-space schema, meaning of the confidence scale, interview strategy as explicit rules: target high-impact × low-confidence areas; vary one axis per visual proposal; contradictions become clarifying questions; recency wins; proposed variants must be deliberately distinct (anti-generic-aesthetic rule).
2. **The full belief state** (it's small — no retrieval needed).
3. **Event log tail** — recent events verbatim, older summarized.
4. The instruction: choose your next action.

### Tools

```
update_beliefs(patch, confidence, rationale)    // sole write path; required every turn (may be empty)
interact(mode: "ask" | "propose", ...)          // exactly one per turn; the model picks the modality
export_design_md()                              // on user request or at confident completion
```

Protocol constraint: every turn = exactly one `update_beliefs` + exactly one `interact`. This forces the model to commit its interpretation of the user's last input to the record before asking the next thing — which is what keeps the visualizer in lockstep with the conversation.

- `interact(mode: "ask")` — natural-language question, optional quick-reply chips. Every question includes a "something else" escape.
- `interact(mode: "propose")` — a visual pick: the probed axis, a target component, 2–4 **variants expressed as token patches** (not markup), and a caption.

### Proposals are token patches — the key decision

The client renders each variant as `render(apply(beliefState, patch), targetComponent)`. Consequences:

- **Coherence for free** — variants differ only along the probed axis; everything else is the current best guess (the optometrist mechanic falls out of the data model).
- **Minimal rendering for free** — "three buttons" is the button component rendered three times; same renderer as the visualizer, one component library, no second code path.
- **Picks apply instantly** — a pick *is* the patch; no interpretation step.
- **No generated markup** — the model outputs data, never HTML.

## 4. Input channels

All three normalize to one message shape before reaching the model:

```jsonc
{ "channel": "chat",    "text": "it's a booking app for dog groomers" }
{ "channel": "region",  "target": "button.primary",
  "tokens_in_scope": { "color.primary": "#1d4ed8", "shape.radius": "6px" },
  "text": "feels too corporate" }
{ "channel": "control", "target": "color.primary",
  "text": "user set primary color to #0f766e via the swatch picker" }
```

- **Chat** — free-text replies and quick-reply picks.
- **Region select** — the user selects a rendered component and types a response *bound to that location*. Resolution is deterministic (no vision model): every rendered component carries its identity, and the component manifest maps component → token dependencies, so region → tokens-in-scope is a lookup.
- **Controls** (color swatch, radius stepper, etc.) — **suggestion composers, not editors.** They let the user express a precise value without typing hex codes, but the output is a well-formed utterance fed to the model. The model applies the change — and can propagate implications (contrast fixes, related tokens) or respond, in the same turn.

### Edit latency: pending previews

The one cost of single-writer: a control tweak can't change the canvas until the model round-trips, and direct manipulation that lags feels broken. Fix: the client renders the suggested value immediately, visually marked provisional (shimmer/pending badge), as throwaway client state — never written to the schema. When the model's patch lands, the canvas settles to *the model's* truth (usually the suggestion, possibly with ripple adjustments). Also: debounce control input — five drags of a stepper coalesce into one message, not five turns.

## 5. Rendering and progressive reveal

- **Pipeline:** belief state → resolve tokens → CSS custom properties → component library (button, card, input, heading, badge, nav…).
- **Component manifest:** each component declares its token-group dependencies, e.g. `button.primary → [color.primary, color.on-primary, shape.radius, type.label, spacing.inset]`. This single manifest powers *both* region-select resolution and progressive reveal.
- **Reveal states** derive from the confidence of a component's dependencies: below threshold → absent; mid-range → rendered blurred (a CSS filter keyed off confidence); above → sharp. No separate reveal bookkeeping.

## 6. design.md — export only

The belief state is the working format for the entire session. `export_design_md()` is a pure serialization: DTCG-style tokens from `groups` into YAML front matter; prose sections (canonical order: Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts) synthesized from `rationale` + transcript. The user never edits it; it can be exported mid-session on request.

## 7. Turn protocol practicalities

- **Triggering:** any user message can trigger a turn; control input is debounced.
- **Latency masking:** stream the NL portion of the turn immediately; animate belief patches into the canvas as they arrive (2–3s reads as "thinking," not lag). Speculative pre-generation of follow-ups per proposal variant is a later optimization.
- **Prototype shape:** a single web app + a thin server route to the Claude API; session state in memory + localStorage; no database, no image generation, no iframes.
