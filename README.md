# mydsstudio

**A design system you discover by conversation, not by filling in a form.**

You describe your product in a sentence. mydsstudio interviews you — chat questions and visual picks, like an optometrist exam ("better one, or better two?") — and a live preview resolves into focus as its confidence grows. Nudge it with a color tweak or a comment on a specific component, then export a portable `design.md`.

This is a V0 prototype: single session, no auth, no database. State lives in the browser (React + `localStorage`).

See [CONCEPT.md](CONCEPT.md) for the why, [IMPLEMENTATION.md](IMPLEMENTATION.md) for the architecture, [V0_PLAN.md](V0_PLAN.md) for the build plan, and [WRITEUP.md](WRITEUP.md) for the short submission writeup.

## What it does

1. You open the app and answer an opening question in plain language ("what are you building, who's it for").
2. The agent commits its interpretation to a shared **belief state** (a small JSON document of design tokens + confidence scores) and asks the next highest-value question — sometimes text, sometimes a **visual pick** among 2–4 rendered variants of one component.
3. The **preview panel** renders your design system live from the belief state: components below a confidence threshold are absent, mid-confidence ones render blurred, high-confidence ones are sharp. You watch the system come into focus rather than waiting for a finished result.
4. You refine it three ways — reply in chat, **click a component and leave a region comment** ("this button feels too corporate"), or drag a **color swatch / radius stepper** (a suggestion, not a direct edit — the model decides what changes and can ripple related tokens).
5. When confidence is high (or on request), you **export `design.md`** — YAML front-matter tokens plus prose sections, each token traceable to the answer or pick that produced it.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript), React 19 |
| Studio shell styling | Tailwind v4 — chat column, controls, chrome only |
| Preview styling | Raw CSS custom properties (`--ds-*`), resolved from the belief state — no Tailwind inside the preview subtree |
| Validation | Zod v4 — one set of schemas shared by the route handler, client, and tests; tool JSON schemas are derived from them |
| LLM | `@anthropic-ai/sdk`, model `claude-opus-4-8`, adaptive thinking, prompt caching |
| Tests | Vitest (jsdom) — unit/integration only, **no test calls the live Claude API** |

## Running it

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### With a Claude API key (live mode)

```bash
cp .env.example .env.local
# edit .env.local and set ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

The key is read server-side only (`src/server/anthropicClient.ts`) and never reaches the client bundle. `GET /api/turn/health` exposes a boolean (`{available: true|false}`) so the client can detect a configured key — it never exposes the key itself.

### Without a key (demo mode)

No key, no problem. The app runs a fully scripted interview — a real `dogGroomerFullInterviewScript` fixture that exercises every channel (chat, region comment, control tweak, a `propose` pick, a completion turn) through the same `applyPatch`/renderer code path live mode uses — so anyone can clone the repo and see the whole loop with zero setup.

Mode resolution (`src/shell/turn/useTurnMode.ts`): if `ANTHROPIC_API_KEY` isn't configured, the app starts in demo mode automatically. A visible **Live / Demo** toggle in the shell lets you switch explicitly, and a live turn that fails in a way that suggests the key or route is broken (server error, network error, bad request on the first turn) demotes the session back to demo mid-session.

### Tests and build

```bash
npm test        # Vitest — 27 files / 197 tests, all offline (mocked client + recorded fixtures)
npm run build   # next build — production build + TypeScript check
npm run lint    # ESLint
```

There's also a headless CLI for exercising the agent loop directly, without the UI:

```bash
npm run cli -- --mock fixtures/recordedTurns/cliScripts/twoTurnDemo --max-turns 5
# or, live:
ANTHROPIC_API_KEY=sk-ant-... npm run cli -- --max-turns 15 --record someInterview
```

See `src/server/README.md` for the CLI's full flag reference and the gate items that are blocked on a live API key in this environment (no key was available to record real interview fixtures at build time — see WRITEUP.md's TODOs).

## Architecture map

Four workstreams own disjoint directories, sharing one frozen contracts layer:

- **`src/contracts/`** — the shared, change-controlled contracts: `BeliefState`/`TokenPatch`/`NormalizedMessage`/`Interaction` Zod schemas, the component manifest, `applyPatch` (the single write path), `renderComponent`/`resolveTokens` signatures, the three tool schemas, and the SSE turn wire format (`delta` / `turn` / `error`).
- **`src/preview/`** — the deterministic renderer: token resolver, ~6 exemplar components (button, card, input, heading, badge, nav) driven purely by `--ds-*` CSS variables, and reveal-state derivation (absent / blurred / sharp from per-component manifest confidence).
- **`src/shell/`** — the interaction surface: chat panel, region-select overlay + comment popover, color/radius controls (suggestion composers, debounced, with a pending-preview shimmer), the proposal picker, session state + `localStorage` persistence, and the turn agent adapters (`RealTurnAgent` over `/api/turn`, `FakeTurnAgent` over the scripted fixture).
- **`src/server/`** — the agent loop: the byte-frozen system prompt, `POST /api/turn` (one call to Claude per turn, streamed as SSE), context assembly (belief state + event-log tail + replayed prior tool calls), protocol validation (exactly one `update_beliefs` + one `interact`/`export_design_md`, one corrective retry), and the CLI harness.
- **`src/export/`** — `serializeDesignMd`: pure serialization of belief state + transcript into DTCG-style YAML front matter plus canonical prose sections (Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts), and the standalone `ExportPanel` UI.
- **`fixtures/`** — shared belief-state snapshots at fixed confidence levels, the fake-agent driver + full scripted interview (demo mode's engine), and recorded/CLI turn fixtures.

## Non-negotiable invariants

(Full detail in [AGENTS.md](AGENTS.md).) Single writer — only server-side `applyPatch` mutates belief state. One `update_beliefs` + one `interact` per turn. Proposals are token patches, never prewritten markup. Two token namespaces, never mixed: shell chrome is `--app-*`, the preview is `--ds-*`.
