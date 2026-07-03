# Demo script (~5 minutes)

A tight storyboard for a screen-recorded walkthrough. The happy path below follows the actual scripted interview shipped in the repo (`fixtures/fakeAgent/scripts/dogGroomerFullInterview.ts`) — demo mode plays exactly this, so the video can be recorded against **demo mode with zero setup**, or against **live mode** with a real key for an unscripted variant of the same beats. Either way, narrate the same story: this is about a search-and-refine loop, not a generate button.

**Persona:** a booking app for dog groomers. **Why this one:** it's semantically rich enough to produce a strong first-guess (warm, natural, small-business, non-corporate) without needing design vocabulary — exactly the point.

Throughout, the camera should linger on the **preview panel** resolving (blur → sharp), not just on the chat — the visual "coming into focus" is the whole pitch.

---

## Beat-by-beat (timestamps assume live narration at a natural pace)

### 0:00–0:20 — Cold open on the empty canvas

- Show the app on load: empty/near-empty preview, first question already waiting in chat: *"What are you building, and who's it for?"*
- **Say:** "No form, no template picker. Just one question." Point out there's no blank design-token form anywhere in this product — the interview *is* the input mechanism.

### 0:20–0:45 — Turn 1: the opening answer (semantic leverage)

- Type: **"a booking app for dog groomers"** (optionally add "independent grooming businesses" if prompted).
- Agent responds; a first `update_beliefs` patch lands — a muted green `color.primary` at **confidence 0.15**, explicitly a guess ("pets/grooming often lean natural, unconfirmed").
- **Say:** "One sentence just collapsed a huge part of the design space — it ruled out brutalist/corporate, leaned natural and warm — before I've answered a single visual question. That's the leverage: one semantic answer moves many parameters at once." Point at the preview: still mostly blurred/absent — low confidence, honestly represented, not hidden.

### 0:45–1:30 — Turn 2: first visual pick (recognition over recall)

- Agent proposes: **"Which primary color feels closer to right?"** — two button variants, muted green vs. bold teal, rendered as real `button.primary` components differing on exactly one token (`color.primary`).
- Click **muted green**.
- **Say:** "I never typed a hex code or named a color theory term. I just said 'that one.' Under the hood this is a token patch applied to the same renderer used everywhere else in the app — not a generated image." Confidence on `color` group visibly climbs (0.15 → 0.4); button in the preview sharpens slightly.

### 1:30–2:10 — Turn 3 + 4: personality question, then shape proposal

- Agent asks personality with quick-replies: *"Warm & friendly" / "Clean & professional" / "Playful & fun."* Click **Warm & friendly** (or type it — show the escape hatch briefly by hovering the free-text box even if you click the chip).
- Agent proposes a **shape.radius** pick on `card.default`: Sharp / Soft / Very round. Click **Soft** (or **Very round** for a stronger visual beat).
- **Say:** "Same mechanic, different axis — always one variable at a time, everything else held at the current best guess. That's what keeps the comparison fair and legible instead of three unrelated cards."
- Preview: more components now sharp; canvas visibly fuller than at 0:45.

### 2:10–2:50 — The nudge #1: a region comment (pointing as critique)

- Click directly on the primary button in the **preview panel** (not chat) to open the region-comment popover. Show the popover surfacing exactly the tokens in scope for that component (color, radius, spacing, etc.) — real transparency into what a comment here can affect.
- Type: **"this feels too corporate"** and submit.
- Agent's next turn acknowledges it and nudges `color.text`/warmth in its rationale ("region comment on the primary button — softened toward the warm green").
- **Say:** "This is the one design-critique skill everyone actually has: pointing at the thing that's wrong and saying so, in their own words, without design vocabulary. The comment is scoped to exactly the tokens that render this component — not a vague 'redo it.'"

### 2:50–3:30 — The nudge #2: a direct control tweak (suggestion, not edit)

- Open the controls bar; drag the **radius stepper** up a notch (or adjust a color swatch).
- Point out the **pending-preview shimmer** — the canvas updates instantly and visibly marked provisional, before the model has responded.
- After the debounce settles (~800ms) and the turn round-trips, the canvas settles to the model's actual patch (radius nudged rounder, confidence climbing to 0.75).
- **Say:** "This isn't a raw style editor — it's a proposal. I dragged a slider, but the model is still the one deciding what actually changes, and it can ripple related tokens if it needs to. The shimmer means 'this is what you asked for,' the settle means 'this is what's true.'"

### 3:30–4:00 — Typography + approach to completion

- Agent asks the last open question (type feel — rounded sans vs. serif); pick **Rounded sans**.
- Agent signals it's converging: *"This is feeling solid — anything else before we wrap up?"*
- **Say:** "Notice this didn't run for a fixed number of questions — it stops asking once its own confidence crosses a threshold, and it'll tell you what it's still guessing versus what you actually confirmed."

### 4:00–4:30 — Confident completion + export

- Confirm done (quick-reply or free text). Final `update_beliefs` lands: every touched group crosses the sharp threshold (~0.85–0.92); the full component library in the preview is now sharp — no blur, no absent components.
- Agent's response signals completion; the **Export CTA** appears.
- Click **Export**, show the panel: **View raw** to reveal the YAML front matter + prose sections in order (Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts), then **Download design.md**.
- **Say:** "Every token in this file traces back to something that happened in the conversation you just watched — the rationale isn't written after the fact, it's assembled from the interview itself. Hand this to a developer or a coding agent and it's immediately usable — the format is deliberately boring and portable."

### 4:30–5:00 — Close

- Scroll the exported `design.md` briefly to show a rationale line next to a token (e.g. "radius rounded because you nudged it and said 'friendly, not corporate'").
- **Say (closing line):** "The point isn't that AI generated a design system. It's that I never had to know what I wanted in design terms — I just reacted, pointed, and nudged, and the system did the work of turning that into something structured and explainable."

---

## What to emphasize at each step (quick-reference)

| Beat | Emphasize |
|---|---|
| Opening answer | One sentence → many parameters moved at once (semantic leverage, not a form) |
| First visual pick | Recognition beats recall; picks are token patches, not generated images |
| Personality + shape proposal | One axis per proposal — fair, legible comparisons |
| Region comment | Pointing at a real rendered artifact is a critique skill everyone has |
| Control tweak | Suggestion-composer, not a raw editor — pending preview vs. settled truth |
| Convergence | Confidence-driven stopping, not a fixed script; guesses flagged honestly |
| Export | The transcript *is* the rationale generator — portable, explainable output |

## Backup: demo mode (no key required)

If recording without an `ANTHROPIC_API_KEY` configured (or to guarantee a repeatable take), the app's **Demo** toggle drives this exact scripted interview — same beats, same tokens, same final `design.md` shape, zero network calls. It's not a watered-down stand-in: it exercises the identical `applyPatch`/renderer code path live mode uses, including the region comment and control-message turns. Mention on camera (or in a title card) that this run is in demo mode if that's the case, and that a live key produces the same loop with the model actually reasoning turn to turn rather than replaying a script.
