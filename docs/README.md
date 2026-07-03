# Documentation

Engineering and design reference for **mydsstudio** — a conversational design-system studio where a user describes their product in plain language, answers a mix of chat and visual questions, watches a design system resolve in a live preview, refines it, and exports a portable `design.md`.

## Contents

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — how the system is built: the single-writer belief-state model, the module map, the one-call-per-turn agent loop and SSE wire format, the rendering + progressive-reveal pipeline, the contract → tool-schema derivation, run modes, persistence, prompt caching, and the testing strategy.
- **[DESIGN.md](DESIGN.md)** — the interaction and visual design: the creative-leverage thesis (iteration / variation / refinement), the three input channels, proposals as a variation instrument, progressive reveal as feedback, and the "dark tool, light artifact" studio shell design system.

## Related top-level docs

- **[../CONCEPT.md](../CONCEPT.md)** — the product concept and motivation.
- **[../IMPLEMENTATION.md](../IMPLEMENTATION.md)** — the settled invariants (the non-negotiables the code is built around).
- **[../V0_PLAN.md](../V0_PLAN.md)** — the V0 build plan and parallel-workstream decomposition.
- **[../WRITEUP.md](../WRITEUP.md)** — the project write-up (why this approach, key decisions, tradeoffs, extensions).
- **[../DEPLOY.md](../DEPLOY.md)** · **[../DEMO_SCRIPT.md](../DEMO_SCRIPT.md)** — hosting plan and demo storyboard.

## Reading order

New to the codebase? Read **[../CONCEPT.md](../CONCEPT.md)** → **[DESIGN.md](DESIGN.md)** → **[ARCHITECTURE.md](ARCHITECTURE.md)** → **[../IMPLEMENTATION.md](../IMPLEMENTATION.md)**.
