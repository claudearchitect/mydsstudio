# V0 plan

Build plan for the first working prototype, structured for **parallel execution by independent agents**. Architecture decisions live in [IMPLEMENTATION.md](IMPLEMENTATION.md) — this file is scope, stack, sequence, and validation. Anything not specified here is the implementer's call, but the architecture doc's invariants (single writer, proposals as token patches, one `update_beliefs` + one `interact` per turn) are not negotiable.

## V0 goal

One end-to-end happy path: a user with no design vocabulary opens the app, describes their product in a sentence, answers a mix of chat questions and visual picks, watches the design system come into focus in the preview, nudges a couple of things (a region comment, a color tweak), and exports a valid design.md — in a session of roughly 10–15 turns.

Demo-quality, not production-quality: single session, single user, no persistence beyond the browser, no auth.

## Scope

**In:**
- Belief state schema + deterministic renderer with progressive reveal (blur + threshold-gated components)
- Single interviewer agent on the Claude API with the three-tool protocol (`update_beliefs`, `interact`, `export_design_md`)
- All three input channels: chat, region-select + respond, controls-as-suggestion-composers (colors + border radius only for V0)
- Proposal rendering (2–4 variants as token patches on a target component)
- design.md export
- Pending previews + control debounce

**Out (documented, not built):**
- Speculative pre-generation of next turns
- Bring-your-own-context seeding (website/Figma/logo import)
- Screenshot enrichment on region comments
- Multi-brand, export targets beyond design.md, session resume/history
- Motion & illustration parameter groups (V0 latent space: color, typography, spacing, shape, elevation, voice)

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js** (App Router, TypeScript) | One app: React UI + a route handler for Claude calls. Streaming via route handler `ReadableStream`. |
| Studio shell styling | **Tailwind** | Chat panel, question cards, controls, layout. Themed per **Studio shell design** below. |
| Preview styling | **Raw CSS custom properties** | The design-system preview is ordinary DOM styled by CSS variables resolved from the belief state — no Tailwind inside the preview subtree. Scope Tailwind's preflight/base styles away from the preview container. |
| LLM | **`claude-opus-4-8`** via `@anthropic-ai/sdk` | Adaptive thinking (`thinking: {type: "adaptive"}`). Do NOT send `temperature`/`top_p`/`top_k` or `budget_tokens` — they 400 on this model. `output_config: {effort: "high"}`. |
| Streaming | `client.messages.stream()` + `finalMessage()` | Stream the NL text of `interact` to the UI as deltas; parse tool calls from the final message. |
| Tool schemas | `strict: true`, `additionalProperties: false`, `required` on every schema | Guarantees `tool_use.input` validates exactly — the belief patch is machine-applied, so malformed input must be impossible. |
| Prompt caching | Frozen system prompt with `cache_control: {type: "ephemeral"}` on the last system block; second breakpoint on the last content block of the newest message | System prompt must contain zero dynamic content. Serialize tools deterministically. Verify via `usage.cache_read_input_tokens`. |
| Validation schemas | **Zod** | One set of Zod schemas shared between route handler, client, and tests. Tool JSON schemas derived from (or checked against) the Zod definitions. |
| State | React state + localStorage snapshot | No database. |
| Tests | **Vitest** (unit only) | Pure-logic coverage; flows validated manually per the gates below. |

## Studio shell design (chrome)

The shell matches the **Anthropic / Claude app dark aesthetic** (reference: the Claude desktop app): warm near-black surfaces, ivory text, terracotta accent, soft 1px borders, generous radii. Two hard rules:

1. **Two token namespaces, never mixed.** Shell theme tokens are `--app-*` (fixed, defined once in globals); belief-state tokens are `--ds-*` (dynamic, written by the resolver). Nothing inside the preview subtree reads `--app-*`; nothing in the shell reads `--ds-*`.
2. **Dark chrome, light artifact.** The preview area renders on its own light neutral surface (`#faf9f5` warm paper) framed as a card inside the dark chrome — the user's emerging design system sits on a neutral ground and is never visually contaminated by the tool's own styling. (If the user's system is itself dark, it still reads correctly against the paper frame.)

Shell theme tokens (wire into Tailwind's theme in Phase 0; values eyeballed from the Claude app — implementer may fine-tune, but stay in this family):

| Token | Value | Use |
|---|---|---|
| `--app-bg` | `#262624` | Main background |
| `--app-bg-deep` | `#1f1e1c` | Sidebar / chat column |
| `--app-bg-raised` | `#30302e` | Cards, question bubbles, popovers |
| `--app-bg-input` | `#393937` | Text inputs, chips |
| `--app-text` | `#f5f4ef` | Primary text |
| `--app-text-secondary` | `#b8b5a9` | Secondary text |
| `--app-text-muted` | `#8a887d` | Hints, timestamps |
| `--app-border` | `#3d3c38` | 1px hairlines everywhere |
| `--app-accent` | `#d97757` | Primary actions, active states (terracotta) |
| `--app-accent-hover` | `#c96442` | Accent hover |
| `--app-link` | `#6b9bd2` | Links, focus rings |
| `--app-positive` | `#77a75f` | Confirmations, confidence-up |
| `--app-negative` | `#d2604f` | Errors |
| `--app-radius-sm / -md / -lg` | `6px / 10px / 14px` | Inputs / cards / panels; pills use `9999px` |

Typography: system sans stack (`ui-sans-serif, -apple-system, "Segoe UI", sans-serif`) — Anthropic's Styrene is proprietary; the system stack at these colors reads close enough for V0. 14px base, 13px secondary, sentence case, no heavy weights above 600.

**Layout** (two-pane, like the reference app):
- **Left column (~420px, `--app-bg-deep`):** the conversation — chat history, the current `ask`/`propose` interaction card, text input. Proposal variants render inside this column as light mini-cards (they're artifact, so they sit on paper swatches).
- **Right pane (fills, `--app-bg`):** the preview card (paper surface) with the component library, plus a slim docked controls bar (color swatches, radius stepper) and a top-right header with session title and Export button.
- Region-select happens directly on the preview; the comment popover is chrome-styled (`--app-bg-raised`).

**Turn shape (workstream C):** one API call per turn — no tool-runner loop. The server assembles system prompt + belief state + event tail, calls Claude with the three tools, expects exactly one `update_beliefs` + one `interact` in the response (parallel tool use), applies the patch server-side, and returns `{beliefState, interaction}` to the client. Both tool calls' `tool_result` acks go back in a **single** user message on the next turn. Always read `tool_use.input` as the SDK's parsed object — never string-match serialized JSON.

## Execution structure

```
Phase 0: Scaffolding + contracts          ← ONE agent, serial, everything blocks on this
   │
   ├────────────┬────────────┬────────────┐
   ▼            ▼            ▼            ▼
Workstream A  Workstream B  Workstream C  Workstream D     ← FOUR agents, fully parallel
Renderer &    Interaction   Agent loop    design.md
preview       shell         (server)      export
   │            │            │            │
   └────────────┴─────┬──────┴────────────┘
                      ▼
Phase 2: Integration + polish             ← ONE agent (or A+B+C owners jointly), serial
```

**Why this decomposition works:** the only things the workstreams share are the contracts frozen in Phase 0 — the Zod schemas, the component manifest, the `renderComponent` interface, and the fixture formats. A renders state to pixels; B turns user actions into messages; C turns messages into new state; D serializes state to a file. Each consumes contracts, none consumes another's implementation.

**Contract-freeze rule:** after Phase 0, the shared contract files are change-controlled. A workstream needing a contract change must not edit it unilaterally — it flags the need, the change lands as a dedicated commit, and all workstreams rebase on it. Everything else (each workstream's own directories) is free territory with no cross-workstream file overlap.

---

## Phase 0 — Scaffolding + contracts (serial, blocks everything)

One agent sets up the repo skeleton and freezes every interface the parallel workstreams share.

- [ ] Next.js + TypeScript + Tailwind + Vitest project scaffold; directory layout with one directory per workstream (`src/preview/`, `src/shell/`, `src/server/`, `src/export/`, `src/contracts/`, `fixtures/`)
- [ ] **Contracts** (`src/contracts/` — frozen at end of phase):
  - [ ] Zod schemas: `BeliefState` (meta, groups with confidence, tokens with `$value`/`$type`/provenance, rationale entries, event log), `TokenPatch`, `NormalizedMessage` (chat/region/control), `Interaction` (`ask`/`propose` discriminated union), tool input schemas for all three tools
  - [ ] Component manifest: `componentId → tokenGroup[]` for the ~6 exemplar components (button, card, input, heading, badge, nav)
  - [ ] `renderComponent(state: BeliefState, componentId: string): ReactNode` interface + trivial placeholder implementation (gray boxes) so B can build against it before A replaces it
  - [ ] `applyPatch(state, patch) → state` — implemented here in full (pure, immutable, provenance stamping), since A, B, C, and D all consume it
  - [ ] Token resolver signature: `resolveTokens(state) → Record<'--token-name', value>` (implementation belongs to A; signature + naming convention frozen here)
- [ ] **Fixtures** (`fixtures/` — formats frozen, contents extensible):
  - [ ] Initial "empty session" belief state
  - [ ] Hand-written belief states at ~0.1 / 0.4 / 0.7 / 0.95 confidence (A's test data, B's demo data)
  - [ ] Fake-agent turn format: a fixture file of `{update_beliefs, interact}` pairs + a tiny driver that plays them (B's stand-in for C)
- [ ] Shell theme: `--app-*` tokens from **Studio shell design** in `globals.css`, wired into the Tailwind theme; two-pane layout skeleton (chat column + preview pane) with placeholder content
- [ ] **Turn wire format contract** (`src/contracts/`): the `/api/turn` response is an SSE stream with three event types — `delta {text}` (NL text of `interact` as it streams), `turn {beliefState, interaction, usage}` (final payload), `error {code, message}`. Client helper that consumes a `fetch` ReadableStream into these events. C implements the server side, B consumes the client side; freezing the framing here keeps them independent.
- [ ] Vitest: `applyPatch` (incl. provenance), schema round-trips
- [ ] `ANTHROPIC_API_KEY` via env, `.env.example`, key never reaches the client

**Exit gate:** `npm test` green; app boots showing placeholder preview; all four workstream directories exist with contracts importable. Tag the commit — all workstreams branch from it.

---

## Parallel workstreams (independent — assign one agent each)

### Workstream A — Renderer & preview

*Consumes: `BeliefState`, manifest, resolver signature, confidence fixtures. Produces: the real `renderComponent`, the preview panel.*

- [ ] Token resolver implementation: belief state → CSS custom properties
- [ ] Exemplar component library (~6): plain React components consuming only CSS variables, each tagged `data-component`
- [ ] Reveal-state derivation: per component, min/weighted confidence of manifest dependencies → `absent | blurred | sharp`; blur as CSS `filter`; constants in one config object
- [ ] Preview panel: renders the library from a belief state with reveal states applied; smooth transitions on state change
- [ ] Replace the Phase-0 placeholder `renderComponent` (same signature — drop-in)
- [ ] Dev-only fixture switcher across the confidence fixtures
- [ ] Vitest: resolver output, reveal-state thresholds, manifest lookups

**Gate (manual, fixture switcher):** 0.1 fixture ≈ empty preview; 0.4 partially blurred; 0.95 all sharp; transitions don't break layout. Changing a token value in a fixture restyles every dependent component.

### Workstream B — Interaction shell

*Consumes: `NormalizedMessage`, `Interaction`, manifest, `renderComponent` (placeholder ok), fake-agent driver. Produces: all user-facing input surfaces.*

- [ ] Chat panel: message list, free-text input, quick-reply chips, always-present "something else" affordance
- [ ] Region-select overlay: hover outline on `data-component` elements → click → popover with text input; resolves `tokens_in_scope` via the manifest with current resolved values
- [ ] Controls: color swatch (per color token) and radius stepper — emit utterance messages, never write state
- [ ] Debounce: rapid control input coalesces into one message (~800ms settle)
- [ ] Pending preview: provisional client-side render of a suggested control value (shimmer/badge), discarded when the next belief state arrives
- [ ] Proposal picker: given a `propose` interaction, render 2–4 variants side by side via `renderComponent(applyPatch(state, patch), target)`; capture pick as a message; "none of these" escape
- [ ] Session UI shell: the two-pane layout from **Studio shell design** composing chat column + preview slot + controls bar; localStorage snapshot/restore of state + event log (with a schema-version field so stale snapshots are discarded, not crashed on)
- [ ] Turn lifecycle states: one in-flight turn at a time — input composes freely but submission is disabled while a turn is streaming; visible thinking/streaming indicator; `error` events surface as a chrome-styled banner with a retry action
- [ ] Dev inspector panel showing outgoing normalized messages
- [ ] Vitest: message normalization per channel, debounce coalescing, region → tokens-in-scope resolution, proposal patch application
- [ ] Extend the fake-agent fixture with a full scripted interview to drive every surface

**Gate (manual, fake agent):** all three channels produce correctly-shaped messages in the inspector; scripted `propose` renders distinct variants and a pick applies its patch; rapid stepper drags produce exactly one settled message with immediate pending preview; region-select on the button reports exactly the manifest-declared groups.

### Workstream C — Agent loop (server, headless)

*Consumes: all Zod schemas, `applyPatch`. Produces: `/api/turn`, the system prompt, recorded response fixtures. Needs no UI — build and test against a CLI harness.*

- [ ] System prompt: role, parameter-space schema, confidence-scale semantics, interview strategy rules (info-gain targeting, one axis per proposal, contradiction → clarify, recency wins, deliberately-distinct variants, always an escape hatch). Static — zero interpolated values.
- [ ] Tool definitions for the three tools — strict schemas generated from/checked against the contract Zod definitions
- [ ] Route handler `POST /api/turn`: assemble context (system + full belief state + event tail), call Claude streaming (`max_tokens: 16000`), emit the SSE events per the Phase-0 wire format (`delta` for NL text, `turn` with the final payload, `error` on failure), apply patch server-side
- [ ] **Kickoff turn**: a new session posts a `session_start` event with an empty log — the agent's first turn asks the opening question (what's the product, who's it for). No hardcoded first question; the model owns the interview from turn one.
- [ ] Turn-protocol enforcement: exactly one `update_beliefs` + one `interact` per turn; one corrective retry on violation, then an `error` SSE event with a machine-readable code
- [ ] API failure handling: SDK typed-exception chain (rate limit vs server error vs bad request) mapped to `error` event codes; the client decides retry UX
- [ ] Event-log tail management: recent events verbatim; older summarized (size threshold is fine for V0)
- [ ] Prompt-cache hygiene: byte-identical system prompt and tool serialization across turns; per-turn dev logging of token usage incl. `cache_read_input_tokens` and latency
- [ ] **CLI harness**: play an interview from the terminal (type answers, see interactions as text, dump belief state) — C's full validation environment, independent of A/B
- [ ] Record 2 full real interviews as committed fixtures (for integration tests and B's demos)
- [ ] Vitest: context assembly (system prompt byte-stable across turns), tool-call validation/retry, patch application from a recorded real response fixture

**Gate (CLI harness, live API):** two contrasting personas ("booking app for dog groomers", "B2B compliance dashboard") converge to different belief states with climbing confidence; a deliberately inconsistent answer triggers a clarifying question; a `control` message is acknowledged and ripples where warranted; no turn violates the protocol post-retry; `cache_read_input_tokens > 0` from turn 2 onward; median turn latency under ~8s.

### Workstream D — design.md export

*Consumes: `BeliefState` schema, confidence fixtures. Produces: pure serialization module + export UI. Smallest workstream — can also be picked up by whichever agent finishes first.*

- [ ] `serializeDesignMd(state, transcript) → string`: DTCG-style tokens from `groups` → YAML front matter; prose sections from `rationale` + transcript in canonical order (Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts)
- [ ] Partial-export handling: low-confidence groups marked "inferred, not confirmed"
- [ ] Export UI component: download as `design.md` + view raw (mountable anywhere; wired into the shell during integration)
- [ ] Vitest: front matter round-trips through a YAML parser; section order matches the spec; every exported token traces to a belief-state entry; low-confidence marking

**Gate:** serializing each confidence fixture yields a parseable design.md whose values match the fixture exactly.

---

## Phase 2 — Integration + polish (serial)

One agent (with the workstream branches merged) wires the seams. All items here are cross-workstream by nature — that's why they wait.

- [ ] Wire B's channels to C's `/api/turn`; fake agent stays behind a flag (tests/demos)
- [ ] Streaming NL deltas rendered live in B's chat panel
- [ ] Pending-preview reconciliation against real belief patches (B + C)
- [ ] Completion state: model signals confident completion → flagged guesses + export CTA (B + C + D)
- [ ] Rationale surfacing: tap/hover a preview component → rationale claims for its token groups (A + C)
- [ ] Mount D's export UI in the shell; verify mid-session export
- [ ] Visual pass on the studio shell (Tailwind)
- [ ] Full-suite run: `npm test` + replay one recorded interview fixture through the shell before final acceptance

## Final acceptance (definition of done)

- All workstream gates + the following, on the integrated app:
- The full happy path from the V0 goal paragraph completes unassisted by someone who hasn't read this repo.
- The exported design.md: YAML front matter parses; canonical section order; every token matches the final belief state; prose reflects decisions actually made (spot-check 3 tokens against the transcript).
- Export works mid-session; refreshing the page restores the session from localStorage.
- The shell visually matches the **Studio shell design** spec: dark warm chrome, terracotta accent, and the preview clearly reading as a light artifact framed by the dark tool.
- No test calls the live Claude API (recorded fixtures only); `npm test` green.

## Coordination notes for the orchestrator

- Phase 0 is the critical path — keep it minimal; anything not a shared contract belongs in a workstream.
- A, B, C, D touch disjoint directories; merge order doesn't matter. B merges cleanly before A because the placeholder `renderComponent` keeps it functional.
- C is the long pole (prompt iteration against the live API) — start it first if staggering; D is the shortest.
- If a contract must change mid-flight: stop, land the contract change as its own commit, have all in-flight agents rebase before continuing.
