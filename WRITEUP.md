# Writeup

## Why this concept

Most "AI design tool" demos are one-shot: describe what you want, get a generated result, maybe regenerate if you don't like it. That's leverage over *output*, not over the *process* of arriving at a design. It also asks the wrong thing of the user — "describe your design system" demands recall (vocabulary most people don't have), when the thing people are actually good at is recognition: shown two buttons, almost anyone can say which one feels more like their brand.

mydsstudio inverts the interaction: instead of a generate button, it's an interview. The AI holds a running hypothesis (the belief state), asks whichever question narrows it fastest, and progressively reveals that hypothesis as a live, real-component preview. The user reacts, points, and occasionally explains — recognition, not recall — and the system converges. That's the creative-leverage bet this project is making: control over *iteration and refinement*, not a single roll of the dice.

## What's non-obvious about it

A few decisions that aren't the first thing you'd reach for, and why they mattered:

- **The belief state is the only thing that gets bigger.** Everything else in the app — chat transcript, region comments, control drags — is a funnel into one shared document. There's exactly one write path (`applyPatch`, server-side only). This sounds like architecture astronautics until you try to keep a preview, an export, and a chat panel in sync any other way — with three read surfaces and one writer, "is the UI showing the true state" is never a question you have to ask.
- **Proposals are data, not markup.** When the agent wants to show you three button variants, it doesn't generate three buttons — it emits three `TokenPatch`es and the client renders each one through the exact same `renderComponent(applyPatch(state, patch), target)` path used everywhere else. This is what makes "vary one axis, hold everything else at the current best guess" (the optometrist trick) fall out of the data model for free, instead of being a prompting convention that can silently drift.
- **Confidence is a claim, not a computed value.** The client never calculates how sure the system is about anything — the model asserts a 0–1 confidence per token group every time it writes, and the renderer just reads it (below threshold: absent; mid-range: blurred via CSS filter; above: sharp). This keeps the "watch it come into focus" feeling honest: what you see resolving is literally the model's own calibration, not a UI animation layered on top.
- **The three-tool turn protocol.** Every turn, the model must call exactly one `update_beliefs` and exactly one of `interact`/`export_design_md`, in parallel, in a single response — never a multi-step tool loop. Forcing "commit your interpretation of what just happened" before "decide what happens next" is what keeps the visualizer in lockstep with the conversation; skip it and you get a chat that talks about state changes it hasn't actually made yet.
- **Two token namespaces that never touch.** Shell chrome (`--app-*`, Tailwind, dark Claude-app aesthetic) and the belief-state preview (`--ds-*`, raw CSS variables, light paper surface) are kept structurally separate — nothing in the preview subtree can accidentally inherit the tool's own styling. It's a small rule with an outsized payoff: the user's emerging design system always reads as *their* artifact sitting inside the tool, never as a themed version of the tool itself.
- **One API call per turn, with prompt caching doing real work.** The system prompt is a byte-identical string (zero interpolation) with a cache breakpoint on its last block, plus a second breakpoint on the newest message — so `cache_read_input_tokens` should be nonzero from turn 2 onward. Combined with adaptive thinking, this keeps a genuinely LLM-driven interview (not a decision tree) from becoming a latency and cost disaster turn after turn.

## Key tradeoffs

- **Single writer costs you edit latency.** A control tweak (drag a color swatch) can't land on the canvas until the model round-trips — direct manipulation that visibly lags feels broken. The fix is a pending-preview layer: the client renders the suggested value immediately as throwaway, visually-marked-provisional state, then reconciles to the model's actual patch when it arrives. It's a real architectural cost, paid deliberately, because the alternative (a second write path for "fast" edits) breaks the single-source-of-truth guarantee everything else leans on.
- **Real intelligence over a scripted flow.** A hardcoded decision tree would be cheaper, faster, and more predictable — but it can't do information-gain question targeting, contradiction detection ("you said playful earlier, now you're saying corporate — which is it?"), or free-text interpretation, which are the actual point. Accepted deliberately, see CONCEPT.md §9.
- **`min` confidence combination, not weighted.** A component's reveal confidence is the minimum across its manifest dependencies' group confidences — conservative and simple, at the cost of not distinguishing "one dependency is weak" from "all dependencies are middling." Correct call for V0's manifest, which doesn't declare per-dependency weights; documented as a named strategy (`REVEAL_CONFIG.combine`) specifically so it's a config change later, not a rewrite.
- **Demo mode as a first-class fallback, not an afterthought.** Because the whole point is showing creative leverage, not gating the demo behind "bring your own API key," a scripted-but-real interview (same `applyPatch`, same renderer, same every-channel coverage) runs with zero setup and is the automatic fallback whenever a key isn't configured or a live turn fails hard.

## What I'd build next

**Lead fast-follow: "vary again / go bolder."** Right now a `propose` interaction gives you 2–4 variants once, on one axis, and you pick one. The natural next control is a way to ask for another round along the *same* axis — "none of these, but warmer" or "give me more contrast between the options" — without falling back to free text. This is the most direct upgrade to creative leverage available: it turns a single proposal into an actual exploration loop, closer to "keep showing me directions until one clicks" than "pick from this one basket." Mechanically it's a new interaction affordance (a re-roll control on the proposal picker) that emits a `NormalizedMessage` asking the agent to re-propose the same axis with an explicit steer, reusing every existing mechanism (token patches, manifest resolution, the renderer) — no new architecture, just a new message shape and a system-prompt rule for how to respond to it.

Documented, deliberately out of scope for V0 (see CONCEPT.md §10, V0_PLAN.md "Out"):

- **Speculative pre-generation** of the next likely turn while the user is still considering the current one, to mask latency further.
- **Bring-your-own-context seeding** — point the agent at an existing site, Figma file, logo, or brand doc so the interview starts from real evidence instead of zero, turning discovery into refinement.
- **Screenshot enrichment** on region comments, so "this feels off" can be grounded in an actual visual snapshot rather than just the token values in scope.
- **Multi-brand / sub-brand systems** — running the interview against an existing `design.md` as a prior.
- **Motion and illustration parameter groups** — the schema stays open to them (`motion`/`voice` groups exist in the belief-state schema) but V0 doesn't interview on or render them.

## Time spent

> **TODO (human):** fill in actual hours/days per phase. Suggested breakdown to fill in:
> - Concept + architecture design (CONCEPT.md, IMPLEMENTATION.md, V0_PLAN.md): ___
> - Phase 0 scaffolding + contracts: ___
> - Workstream A (renderer/preview): ___
> - Workstream B (interaction shell): ___
> - Workstream C (agent loop/server): ___
> - Workstream D (export): ___
> - Integration + polish (Phase 2): ___
> - Docs/deliverables (this pass): ___
> - **Total: ___**
