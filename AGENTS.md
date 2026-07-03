<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# mydsstudio — agent guide

A conversational design-system studio: a user describes their product in plain language, answers a mix of chat and visual questions, and watches a design system resolve in a live preview, then exports a `design.md`. Single-session demo (no auth, no DB; state in React + localStorage).

**Read first:** [V0_PLAN.md](V0_PLAN.md) (scope, sequence, gates) and [IMPLEMENTATION.md](IMPLEMENTATION.md) (architecture + invariants). This file is the short version; those are authoritative.

## Commands

- `npm run dev` — start the app (Next.js App Router).
- `npm test` — Vitest unit suite. Must be green before any commit. **No test may call the live Claude API** — use recorded fixtures only.
- `npm run build` — production build; must succeed.
- `npm run lint` — ESLint.

## Stack

Next.js (App Router, TypeScript) · Tailwind v4 (studio shell only) · raw CSS custom properties (preview only) · Zod v4 (single source of validation) · `@anthropic-ai/sdk` with model `claude-opus-4-8` · Vitest (jsdom).

## Non-negotiable invariants

These are enforced across the codebase — violating one is a bug, not a style choice.

- **Single writer.** Belief state is mutated in exactly one place: server-side `applyPatch(state, patch)` in `src/contracts/`. The client, controls, and UI never write belief state directly — they emit messages. Don't add a second write path; route the change through a message → patch.
- **One `update_beliefs` + one `interact` per turn.** Each `/api/turn` call expects exactly one of each tool call (parallel tool use). Both tool results are acked in a **single** user message on the next turn. Don't build a multi-step tool-runner loop.
- **Proposals are token patches.** A `propose` interaction's variants are `TokenPatch`es applied to a target component, never prewritten markup. Render them via `renderComponent(applyPatch(state, patch), target)`.
- **Two token namespaces, never mixed.** Shell chrome uses `--app-*` (fixed, in `globals.css`). Belief-state preview uses `--ds-*` (dynamic, from `resolveTokens`). Nothing in the preview subtree reads `--app-*`; nothing in the shell reads `--ds-*`. Don't reference one family from the other's subtree.
- **`tool_use.input` is already parsed.** Read it as the SDK's object — never string-match serialized JSON.

## Claude API rules (model `claude-opus-4-8`)

- Use adaptive thinking: `thinking: {type: "adaptive"}` and `output_config: {effort: "high"}`.
- **Do NOT send `temperature`, `top_p`, `top_k`, or `budget_tokens`** — they return HTTP 400 on this model.
- Tool schemas: `strict: true`, `additionalProperties: false`, and `required` listing every field. Malformed tool input must be impossible because the patch is machine-applied.
- Prompt caching: the system prompt must be **byte-identical every turn** (zero interpolated values) with `cache_control: {type: "ephemeral"}` on the last system block; second breakpoint on the last content block of the newest message. Serialize tools deterministically. Verify with `usage.cache_read_input_tokens` (should be > 0 from turn 2).
- `max_tokens: 16000`. Stream with `client.messages.stream()`; parse tool calls from `finalMessage()`.

## Layout & ownership

Four workstreams own disjoint directories — do not edit another's files:

- `src/contracts/` — **frozen shared contracts** (Zod schemas, component manifest, `applyPatch`, `renderComponent`/`resolveTokens` signatures, tool schemas, SSE wire format). Change-controlled: needing a change here means flagging it, landing a dedicated commit, and having in-flight work rebase — never edit unilaterally.
- `src/preview/` — Workstream A: renderer, token resolver, reveal states.
- `src/shell/` — Workstream B: chat, region-select, controls, proposal picker, two-pane shell.
- `src/server/` — Workstream C: `/api/turn`, system prompt, CLI harness.
- `src/export/` — Workstream D: `serializeDesignMd`, export UI.
- `fixtures/` — shared belief-state + fake-agent fixtures (formats frozen, contents extensible).

## Conventions

- Secrets: `ANTHROPIC_API_KEY` comes from env; see `.env.example`. The key must never reach the client — only `src/server/` reads it.
- Do not commit `private_notes.md` (gitignored — user's personal notes).
- Commits are made by the orchestrator at stable checkpoints; keep the working tree buildable and `npm test` green so each checkpoint is revertible.
