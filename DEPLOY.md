# Deploy

mydsstudio is a stock Next.js App Router app (one route handler, one page) — it deploys to Vercel with no special configuration beyond the environment variable below. This doc covers the hosting plan, the env var, and the gotchas specific to a streaming LLM route.

## Hosting: Vercel

1. Import the repo into Vercel (or `vercel` CLI from the repo root).
2. Framework preset: Next.js (auto-detected).
3. Build command: `next build` (default). Output: `.next` (default).
4. No database, no external services beyond the Anthropic API — nothing else to provision.

## Environment variable

| Name | Where | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Server-only env var (Vercel Project Settings → Environment Variables) | **Never** prefix with `NEXT_PUBLIC_` — that would bundle it into client JS and ship it to every visitor's browser. It is read in exactly one place, `src/server/anthropicClient.ts`, which is only ever imported from server-side code (`src/app/api/turn/route.ts` and the CLI harness). |

Set it for whichever Vercel environments you want live mode enabled in (Production / Preview / Development). If you deliberately leave it unset in a given environment (e.g. a public Preview URL you don't want burning your quota), the app still works fully via demo mode — see below.

Local dev: copy `.env.example` to `.env.local` and fill in the key; `.env*` is gitignored except `.env.example`.

## `/api/turn` as a route handler

`src/app/api/turn/route.ts` is a Next.js **Node.js runtime** route handler (`export const runtime = "nodejs"` — it uses the `@anthropic-ai/sdk`, which is not edge-compatible) that streams a `text/event-stream` response back to the client via a `ReadableStream`. On Vercel this deploys as a serverless function; streaming works the same way it does with any other streaming Node function (headers are set with `Cache-Control: no-cache, no-transform` and `Connection: keep-alive` in the route itself).

There is also `GET /api/turn/health`, a trivial same-runtime probe that returns `{available: boolean}` — it exists purely so the client can detect whether a key is configured without ever touching the key itself.

### Streaming considerations

- The route makes **one Claude API call per turn** (`client.messages.stream()` + `finalMessage()`), not a multi-step agent loop — so worst-case latency per request is bounded by one model turn (plus, rarely, one corrective retry on a protocol violation — see AGENTS.md/IMPLEMENTATION.md). There is no unbounded tool-calling loop that could run past a function timeout.
- **Function timeout vs. turn latency.** Vercel's default serverless function timeout varies by plan (10s on Hobby, up to 60s+ on Pro/Enterprise, or higher if explicitly configured via `maxDuration`). The system prompt targets adaptive thinking with `effort: "high"`, and V0's own validation gate expects **median turn latency under ~8s** — comfortably inside default limits on Hobby, but a single slow/retried turn could approach it. If you're deploying on a plan with a tight timeout, consider setting `export const maxDuration = ...` in the route (or the equivalent `vercel.json` config) to give a protocol-violation retry room to complete rather than risk the function being killed mid-stream.
- Because the response streams SSE frames as they're produced (`delta` events for the interact text, one terminal `turn` or `error` event), the client sees output well before the full turn completes even if total latency is a few seconds — this is the latency-masking IMPLEMENTATION.md calls for, and it also means a slow turn degrades gracefully in the UI rather than looking hung.
- `/api/turn` is intentionally **stateless per request** — the caller (the client-side `RealTurnAgent`) resends the full belief state and prior-turn record with every call. This means there's no server-side session affinity to worry about; any serverless instance can handle any request, which is exactly the shape Vercel's function model wants.

## Demo mode: the keyless fallback

This is the piece that makes public deployment low-risk: if `ANTHROPIC_API_KEY` isn't set (or the health probe fails, or a live turn errors out in a way that looks like the key/route itself is broken), the app automatically runs in **demo mode** — a fully scripted interview (`fixtures/fakeAgent` + `dogGroomerFullInterviewScript`) driven through the exact same `applyPatch`/renderer code path as live mode, with zero network calls.

Practical implication for hosting: you can deploy a public URL **without** setting `ANTHROPIC_API_KEY` at all, and visitors get a complete, representative walkthrough of every surface (chat, region comment, control tweak, a proposal pick, export) at zero cost and zero quota risk to you. If/when you do set the key, a visible **Live / Demo** toggle in the shell lets visitors choose, and a failed live turn demotes the session back to demo automatically rather than dead-ending the UI.

Recommended pattern for a public demo link: **do not** set `ANTHROPIC_API_KEY` on the public deployment, or set it and accept that any visitor can consume your quota (there is no rate limiting, auth, or per-user key in this V0). If you want a live-capable link that isn't fully public, gate access at the platform level (Vercel password protection / preview-only) rather than relying on anything in-app.

## Build/runtime notes

- `next build` runs a full TypeScript check as part of the build (not a separate step) — a type error fails the Vercel build, not just local dev.
- No new npm dependencies were introduced for this deliverables pass; `package-lock.json` is unchanged by these docs.
- The app is otherwise fully static/dynamic-hybrid: `/` prerenders as static content; `/api/turn` and `/api/turn/health` are the only dynamic (server-rendered on demand) routes, confirmed by `next build`'s route summary.
- `next.config.ts` pins the Turbopack workspace root (`path.resolve(__dirname)`) to avoid Next guessing the wrong root if a stray lockfile exists in a parent directory outside the repo — irrelevant on Vercel's isolated build environment, but worth knowing if you ever build from a monorepo-style checkout.

## Known gap

No live deployment has been performed as part of this task (docs-only pass, no infra access). The plan above is derived from reading the actual route handler, runtime declarations, and V0_PLAN.md's latency targets — not from an observed Vercel deploy. **TODO (human):** do a real `vercel deploy` (or `vercel --prod`) pass and confirm actual cold-start + streaming behavior in production, and adjust `maxDuration` if turn latency runs closer to the timeout than expected.
