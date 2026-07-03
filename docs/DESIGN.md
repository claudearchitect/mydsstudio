# Design

The interaction and visual design of **mydsstudio** — the *why* behind the UX, and the rules that keep the interface coherent. Pairs with [ARCHITECTURE.md](ARCHITECTURE.md) (the *how*).

## 1. The thesis: leverage over the creative loop

The design brief is *creative leverage — real control over iteration, variation, and refinement, not a "generate" button.* Everything here is built to serve that, and deliberately avoids one-shot generation.

| Loop dimension | Mechanism | Why it's leverage, not a generate button |
|---|---|---|
| **Iteration** | Progressive reveal — the design system *resolves* turn by turn (absent → blurred → sharp) as confidence climbs. | The user steers an evolving artifact and watches it come into focus, rather than accepting/rejecting a finished output. |
| **Variation** | Proposals render 2–4 **visual** variants side by side, each a token patch on a real component. | The user chooses a *direction by seeing it*, along one deliberately-probed axis, with a "none of these" escape. |
| **Refinement** | Three channels acting on the *same* artifact: region comments, direct-manipulation controls, and pending previews. | Precise, located control over the emerging system — not a prompt-and-pray text box. |
| **Access** | A person with **zero design vocabulary** produces a valid, portable `design.md`. | A workflow that simply wasn't available to that user before. |

The differentiator is control over the *loop*, not the quality of a single generation.

## 2. The interview, not a form

The core interaction is a conversation with a single interviewer agent that chooses, each turn, whether to **ask** or **propose** — targeting high-impact, low-confidence areas. The user answers in whatever modality fits: type, tap a quick-reply chip, or make a visual pick. Every question carries a "something else" escape so the user is never boxed in.

This matters because the target user can't answer "what's your primary color?" but *can* answer "which of these feels more like you?" and "describe your product in a sentence." The agent translates fuzzy human intent into calibrated token values, showing its work as confidence and rationale.

## 3. Three input channels

All three normalize to a single `NormalizedMessage` shape before reaching the model — the model is the only writer (see [ARCHITECTURE.md §1](ARCHITECTURE.md)).

- **Chat** — free-text replies and quick-reply picks. The conversational backbone.
- **Region select** — the user clicks a rendered component and types a comment *bound to that location* ("this feels too corporate"). Resolution is deterministic, no vision model: every component carries its `data-component` identity, and the manifest maps component → token dependencies, so region → tokens-in-scope is a lookup. The comment reaches the model already scoped to the right tokens.
- **Controls** (color swatch, radius stepper) — **suggestion composers, not editors.** They let the user express a precise value without typing hex codes, but the output is a well-formed *utterance* to the model, never a direct write. The model applies it and can propagate implications (contrast fixes, related tokens) in the same turn.

### Pending previews — hiding single-writer latency

The one cost of single-writer is that a control tweak can't change the canvas until the model round-trips, and laggy direct manipulation feels broken. So the client renders the suggested value *immediately*, visually marked provisional (shimmer/pending badge), as throwaway client state that's **never written to the schema**. When the model's patch lands, the canvas settles to the model's truth — usually the suggestion, sometimes with ripple adjustments. Rapid control input is debounced (~800ms) so five stepper drags coalesce into one message, not five turns.

## 4. Proposals as a variation instrument

A `propose` turn is the studio's variation control. It probes exactly one axis (color temperature, radius, weight…) and offers 2–4 variants that differ *only* along that axis — everything else stays the current best guess. Because each variant is a real token patch rendered on the real component, the user compares actual visuals ("muted green vs bold teal button"), not descriptions. A pick *is* the patch, applied instantly.

**Lead fast-follow (post-V0):** a "vary again / go bolder / different direction" control that regenerates variants along the same axis — turning proposal from *pick-from-a-batch* into *drive-the-exploration*. This is the sharpest expression of "control over variation" and is the top item on the roadmap.

## 5. Progressive reveal as iteration feedback

Reveal state is the user's read on progress. A component is **absent** until its dependencies are touched, **blurred** (a confidence-scaled CSS filter) while the system is unsure, and **sharp** once confident. This gives continuous, glanceable feedback that the conversation is *building something* — and makes uncertainty legible (a blurry card says "we're still figuring out your surfaces") rather than hiding it behind a false-confident render. Rationale surfaces on hover, so a value can always answer "why is it this?" — a trust surface and a correction surface at once.

## 6. Studio shell — the visual design system of the tool itself

Two hard rules govern the chrome, both in service of one idea: **dark tool, light artifact.**

1. **Two token namespaces, never mixed.** Shell chrome uses `--app-*` (fixed, defined once in `globals.css`, wired into Tailwind's `@theme`). The user's emerging system uses `--ds-*` (dynamic, from the resolver). Nothing in the preview reads `--app-*`; nothing in the shell reads `--ds-*`. This guarantees the tool's own styling can never contaminate the artifact being designed.
2. **The preview is a light artifact framed by dark chrome.** The preview renders on its own warm-paper surface (`#faf9f5`) as a card inside the near-black studio — so the emerging design system sits on a neutral ground and reads as *the thing being made*, distinct from the tool making it. (Even a dark user-system reads correctly against the paper frame.)

The shell matches the Anthropic / Claude app dark aesthetic: warm near-black surfaces, ivory text, terracotta accent, 1px hairlines, generous radii.

### Shell theme tokens (`--app-*`)

| Token | Value | Use |
|---|---|---|
| `--app-bg` | `#262624` | Main background |
| `--app-bg-deep` | `#1f1e1c` | Sidebar / chat column |
| `--app-bg-raised` | `#30302e` | Cards, question bubbles, popovers |
| `--app-bg-input` | `#393937` | Text inputs, chips |
| `--app-text` | `#f5f4ef` | Primary text |
| `--app-text-secondary` | `#b8b5a9` | Secondary text |
| `--app-text-muted` | `#8a887d` | Hints, timestamps |
| `--app-border` | `#3d3c38` | 1px hairlines |
| `--app-accent` | `#d97757` | Primary actions, active states (terracotta) |
| `--app-accent-hover` | `#c96442` | Accent hover |
| `--app-link` | `#6b9bd2` | Links, focus rings |
| `--app-positive` | `#77a75f` | Confirmations, confidence-up |
| `--app-negative` | `#d2604f` | Errors |
| `--app-radius-sm / -md / -lg` | `6px / 10px / 14px` | Inputs / cards / panels (pills use `9999px`) |

Typography: system sans stack, 14px base / 13px secondary, sentence case, no weights above 600.

### Layout (two-pane)

- **Left column (~420px, `--app-bg-deep`):** the conversation — history, the current ask/propose card, text input. Proposal variants render here as light mini-cards (artifact sits on paper).
- **Right pane (fills, `--app-bg`):** the preview card (paper surface) with the component library, a slim docked controls bar (color swatches, radius stepper), and a header with the session title and Export.
- **Region-select** happens directly on the preview; the comment popover is chrome-styled (`--app-bg-raised`).

## 7. Developer / debug surfaces

The debug inspector (outgoing normalized messages) is a *developer* surface, clearly labeled and **collapsed by default** — it exists to make the message-normalization pipeline observable during development and demos, and is visually muted so it's never mistaken for a user feature.

## 8. Out of scope for V0 (documented, not built)

Deferred deliberately to keep V0 a single tight happy path: speculative pre-generation of next turns; bring-your-own-context seeding (website / Figma / logo import); screenshot enrichment on region comments; multi-brand and export targets beyond `design.md`; session resume/history; and the motion & illustration parameter groups. The V0 latent space is color, typography, spacing, shape, elevation, and voice.

---

### Cross-references
- System architecture & data flow → [ARCHITECTURE.md](ARCHITECTURE.md)
- Product concept → [CONCEPT.md](../CONCEPT.md)
- Invariants → [IMPLEMENTATION.md](../IMPLEMENTATION.md)
