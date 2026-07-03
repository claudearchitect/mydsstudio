# Architecture

Engineering reference for **mydsstudio** — a conversational design-system studio. Companion to [CONCEPT.md](../CONCEPT.md) (product concept) and [IMPLEMENTATION.md](../IMPLEMENTATION.md) (settled invariants). This document describes *how the running system is put together*: modules, the data model, the turn lifecycle, rendering, and the contract layer that lets the pieces stay decoupled.

## 1. One artifact, one writer

The entire system orbits a single structured document — the **belief state** — under one rule: **only the model writes to it.**

```
 agent turn ──belief patch──▶  belief state  ──deterministic render──▶  preview
     ▲                                                                     │
     └────────────── events (chat / region / control) ◀──── user acts ─────┘
```

Two currencies flow around this loop:

- **Token patches** — the *only* write path, emitted by the model as a structured tool call and applied server-side by `applyPatch`.
- **Events / messages** — every user action (chat reply, quick-reply pick, region comment, control tweak) normalizes into a *message to the model*. The user never edits the schema; the model decides what, if anything, changes.

This is the source of most of the system's leverage: coherence, minimal rendering, and instant "picks" all fall out of having exactly one state and one writer (see §5, §6).

## 2. Module map

Six directories, each with a single responsibility. They share only the frozen contracts in `src/contracts/` — never each other's internals.

| Directory | Responsibility | Key exports |
|---|---|---|
| `src/contracts/` | **Frozen shared contracts.** Zod schemas, `applyPatch`, the component manifest, render/resolve signatures, tool schemas, the SSE wire format. | `BeliefState`, `TokenPatch`, `NormalizedMessage`, `Interaction`, `applyPatch`, `COMPONENT_MANIFEST`, `resolveTokens`, `buildToolDefinitions`, `consumeTurnStream` |
| `src/preview/` | Renders belief state → pixels: token resolver impl, the exemplar component library, reveal-state derivation, the preview panel. | `renderComponent`, `PreviewPanel`, `revealState` |
| `src/shell/` | All user-facing chrome: chat, region-select, controls, proposal picker, the two-pane `Session`, mode toggle, debug inspector, localStorage. | `Session`, `ChatPanel`, `ProposalPicker`, `ModeToggle` |
| `src/server/` | The headless agent loop: system prompt, tool defs, `/api/turn`, protocol enforcement, CLI harness. | `turnRunner`, `/api/turn` route, `cli/harness` |
| `src/export/` | Pure serialization of belief state → `design.md`, plus the export UI. | `serializeDesignMd`, `ExportPanel` |
| `fixtures/` | Shared test/demo data: confidence fixtures, the scripted fake-agent interview, recorded live turns. | `beliefStates/*`, `fakeAgent/*`, `recordedTurns/*` |

**Why this holds together:** each module *consumes* contracts and produces its own artifact; none consumes another's implementation. The renderer turns state into pixels, the shell turns actions into messages, the server turns messages into new state, export turns state into a file. That decoupling is what let the four workstreams be built in parallel.

## 3. The belief state (data model)

A small JSON document (a few KB) — the single source of truth for a session, and already `design.md` in shape. Defined by `BeliefStateSchema` in `src/contracts/beliefState.ts`:

```jsonc
{
  "schemaVersion": 1,
  "meta": { "product": "...", "audience": "...", "personality": ["..."] },
  "groups": {                        // z.partialRecord — untouched groups are ABSENT, not confidence 0
    "color": {
      "confidence": 0.35,            // fully model-controlled scalar
      "tokens": {
        "primary": { "$value": "#1d4ed8", "$type": "color", "provenance": ["e07", "e12"] }
      }
    }
  },
  "rationale": [                     // living claims, keyed to the tokens they justify
    { "id": "r03", "claim": "soft radii — user said 'friendly, not childish'",
      "tokens": ["shape.radius"], "evidence": ["e07", "e09"] }
  ],
  "events": [ /* append-only log: session_start | message | update_beliefs | interact | export_design_md */ ]
}
```

Key facts a contributor must know:

- **Latent space (token groups):** `color · typography · spacing · shape · elevation · contrast · motion · voice`. The schema stays open to all eight; V0 actively drives color, typography, spacing, shape, elevation.
- **Tokens are DTCG-shaped** (`$value` / `$type`), so export is *serialization, not translation*. `$type ∈ {color, dimension, fontFamily, fontWeight, fontSize, lineHeight, duration, shadow, string, number}`.
- **Token key convention:** the key inside `groups[group].tokens` is the bare name (`primary`); the dotted form (`color.primary`) is the fully-qualified reference used everywhere else (manifest, patch ops, `rationale.tokens`, region-select scope). Join/split via `src/contracts/tokenRef.ts` — never hand-split strings.
- **`groups` is a partial record.** An untouched group is *absent*, not present at confidence 0 — this distinction drives the `absent` vs `blurred` reveal states (§5).
- **Confidence is fully model-controlled.** The model assigns, updates, and consumes it (for question targeting). The client only reads it. What 0.9 vs 0.4 *means* is defined in the system prompt, not in client code.
- **Rationale is a set of living claims** (~10–20), not a reasoning log. When a belief flips, the claim with that `id` is *replaced*; the event log keeps history. It exists to survive context-window loss, power good contradiction questions, keep confidence calibrated (show-your-work), and pre-write the `design.md` prose layer.
- **`provenance` is stamped only by `applyPatch`** — a list of the event id(s) that most recently justified a value. Never set by hand.

### `applyPatch(state, patch, eventId)`

The one write path, in `src/contracts/applyPatch.ts` — **pure, immutable, provenance-stamping**. Consumed by the server, the CLI harness, the demo driver, and the proposal picker (for throwaway variant renders):

- Returns a new state; never mutates the input.
- Stamps touched tokens' `provenance` with the caller-supplied `eventId` (**replace, not append** — provenance names the most recent justifying event; full history lives in `events`).
- Rationale ops **replace by `id`** (position preserved) or **append** a new `id` — never delete-by-omission.
- Confidence writes **overwrite** the group scalar.
- **Does not touch `state.events`.** The caller owns event-id generation and appends the corresponding event separately. This keeps `applyPatch` a pure function of (state, patch, id).

A `TokenPatch` carries `meta`, `tokens[]`, `confidence[]`, and `rationale[]` — i.e. the confidence and rationale writes travel *inside* the patch, not as separate arguments.

## 4. The turn lifecycle

One API call per turn — **no tool-runner loop**. The server assembles context, calls Claude once, expects exactly one `update_beliefs` + one `interact` (parallel tool use), applies the patch, and streams the result back.

```
 client                         server (/api/turn)                     Claude API
   │  emit NormalizedMessage          │                                     │
   │  (chat|region|control)           │                                     │
   ├─────────── POST ────────────────▶│                                     │
   │                                  │  assemble:                          │
   │                                  │   • system prompt (BYTE-IDENTICAL)  │
   │                                  │   • full belief state               │
   │                                  │   • event-log tail                  │
   │                                  ├──────── messages.stream() ─────────▶│
   │◀───────── SSE: delta{text} ──────┤◀───── NL text of `interact` ────────┤ (streamed)
   │   (streamed live into chat)      │                                     │
   │                                  │◀──── finalMessage(): tool_use ──────┤
   │                                  │  validate: exactly 1 update_beliefs │
   │                                  │           + 1 interact (Zod)        │
   │                                  │  → 1 corrective retry on violation  │
   │                                  │  applyPatch + append events         │
   │◀── SSE: turn{beliefState,        │                                     │
   │        interaction, usage} ──────┤                                     │
   │  render preview + interaction    │                                     │
```

- **Kickoff:** a new session posts a `session_start` event with an empty log; the *model* owns the first question (no hardcoded opener).
- **Both tool results are acked in a single user message** on the next turn.
- **Read `tool_use.input` as the SDK's parsed object** — never string-match serialized JSON.
- **Model config (`claude-opus-4-8`):** `thinking: {type:"adaptive"}`, `output_config: {effort:"high"}`, `max_tokens: 16000`. **Never send** `temperature` / `top_p` / `top_k` / `budget_tokens` — they 400 on this model.

### SSE wire format (`src/contracts/turnWireFormat.ts`)

Three event types framed as `event: <type>\ndata: <json>\n\n`:

| Event | Payload | Meaning |
|---|---|---|
| `delta` | `{ text }` | NL text of `interact`, streamed as it arrives |
| `turn` | `{ beliefState, interaction, usage }` | final payload for the turn |
| `error` | `{ code, message }` | failure; `code ∈ rate_limited \| server_error \| bad_request \| protocol_violation \| network_error \| unknown` |

The client consumes a `fetch` `ReadableStream` via `consumeTurnStream` (an async generator) — framework-agnostic, shared by the shell and the CLI harness. C implements the server side; B consumes the client side; freezing the framing here kept them independent.

### Protocol enforcement & failure handling

- **Turn protocol:** exactly one `update_beliefs` + one `interact`. On violation → one corrective retry, then an `error` SSE with `protocol_violation`. Correctness is enforced *post-hoc via Zod* in `protocolValidation.ts` after every model response — independent of the tool schema's strict mode (see §7).
- **API failures:** the SDK's typed-exception chain (rate limit vs server vs bad request) maps to `error` event codes; the client owns retry UX.
- **Event-log tail:** recent events verbatim, older summarized past a size threshold.

## 5. Rendering & progressive reveal

Pipeline: **belief state → resolve tokens → CSS custom properties → component library.**

- **`resolveTokens(state)`** (`src/preview/`) projects the belief state into `Record<'--ds-…', value>`. Naming: `--ds-<group>-<kebab-token>` via the frozen `dsVarName` helper (`color.primary → --ds-color-primary`; `shape.radiusPill → --ds-shape-radius-pill`). `fontSize`'s `"20px/600"` shorthand splits into a size var + a `-weight` var; color/dimension/shadow pass through as strings. Absent groups contribute nothing (no invented defaults).
- **Component library (~6 exemplars):** button, card, input, heading, badge, nav — plain React consuming *only* `var(--ds-…)`, each tagged `data-component="<componentId>"` (load-bearing for region-select). Vars are written on the `.ds-preview-root` boundary.
- **Component manifest** (`COMPONENT_MANIFEST`): `componentId → dotted token-group deps`. One manifest powers *both* region-select resolution (`tokensInScopeFor`) *and* progressive reveal.
- **Reveal states** derive from the confidence of a component's dependencies (config in one object, `REVEAL_CONFIG`): below `absentFloor` or an untouched dep group → **absent**; mid-range → **blurred** (a CSS `filter` scaled by confidence, capped at `maxBlurPx`, with reduced opacity); above `sharpThreshold` (0.85) → **sharp**. "Absent beats blurred": any untouched dependency group forces `absent`. No separate reveal bookkeeping — it's derived every render.

## 6. Proposals are token patches

A `propose` interaction ships 2–4 **variants expressed as `TokenPatch`es** on a target component — never markup. The picker renders each as `renderComponent(applyPatch(state, patch, throwawayId), target)`. Consequences (the "optometrist" mechanic):

- **Coherence for free** — variants differ only along the probed axis; everything else is the current best guess.
- **One renderer, no second code path** — "three buttons" is the button component rendered three times.
- **Picks apply instantly** — a pick *is* the patch; no interpretation step.
- **The model outputs data, never HTML.**

This is also why proposals are *visual*: because each variant is a real patch on real components, the user sees the actual button in muted-green next to the actual button in bold-teal, not a text label.

## 7. Contract → tool-schema derivation

Tool JSON schemas are **derived from the Zod contracts** (`buildToolDefinitions` in `src/contracts/toJsonSchema.ts`) so the two can't drift. The three tools: `update_beliefs({patch})`, `interact(<Interaction union>)`, `export_design_md({})`.

The Anthropic tool API rejects several JSON-Schema constructs that Zod emits, so the derivation layer adapts them (this was discovered *only* because the live gate exercises the real API — the mocked tests never could):

- strips `minimum`/`maximum` (from the 0–1 confidence bound) and non-0/1 `minItems`/`maxItems` (from the 2–4 variant bound);
- flattens a bare top-level `oneOf` (from `Interaction`'s discriminated union) into a single object schema with nullable branch-specific fields;
- runs `interact` with `strict: false` (its schema nests up to four full `TokenPatch` copies, which exceeds the strict-mode compiled-grammar size limit); the other two tools stay `strict: true`.

**No invariant is weakened.** The Zod contracts themselves are untouched, and `protocolValidation.ts` re-validates every model response against the full Zod schemas (min/max, 2–4 variants, discriminated union) *after* the call. Only the machine-readable copy *sent to the model* is adapted to what the API accepts.

## 8. Run modes: demo vs live

The shell drives turns through a `TurnAgent` interface with two implementations:

- **Live** (`realTurnAgent`) — POSTs to `/api/turn` and consumes the SSE stream. Requires `ANTHROPIC_API_KEY` (server-only).
- **Demo** (`fakeTurnAgent`) — plays a scripted sequence of real `{update_beliefs, interact}` pairs through the *same* `applyPatch`, so the whole happy path (including a `propose` turn and the export/completion state) runs with **no key**. Demo is the automatic fallback when live is unavailable, and is selectable via the `ModeToggle`.

Both modes exercise identical UI — demo mode is a real driver, not a mock.

## 9. Persistence & prompt caching

- **Session state:** React state + a `localStorage` snapshot (state + event log), keyed by `schemaVersion`; a stale-version snapshot is *discarded*, not crashed on. No database.
- **Prompt caching:** the system prompt is **byte-identical every turn** (zero interpolated values) with `cache_control: {type:"ephemeral"}` on the last system block, plus a second breakpoint on the last content block of the newest user message. Tools serialize deterministically. Verified via `usage.cache_read_input_tokens` (> 0 from turn 2 onward). Per-turn token usage + latency are logged in dev.

## 10. Testing strategy

- **Vitest, unit only.** **No committed test calls the live Claude API** — server logic is tested against recorded-turn fixtures and a mock Anthropic client; the shell is tested against the fake-agent driver; the preview/export against the confidence fixtures.
- Discovery excludes `.claude/**` so nested agent worktrees aren't globbed into the run.
- The live API is exercised only during the ad-hoc recording step that produces the `fixtures/recordedTurns/` fixtures; those fixtures are then replayed offline.

---

### Cross-references
- Product concept & motivation → [CONCEPT.md](../CONCEPT.md)
- Settled invariants (the non-negotiables) → [IMPLEMENTATION.md](../IMPLEMENTATION.md)
- Interaction & visual design → [DESIGN.md](DESIGN.md)
- Build plan & workstream decomposition → [V0_PLAN.md](../V0_PLAN.md)
