# Design Rationale — MyDS Studio

**One-liner:** A design system you discover by conversation, not by filling out a form.

**The brief it answers:** creative leverage — real control over iteration, variation, and refinement, not a "generate" button.

---

## 1. Approach & what makes it novel

A user with no or limited design background is better able to respond to a series of questions (especially if they're visual in nature) than to fill out a form about their design system. Prior: users with limited design experience lack the design vocabulary to define what their design system is, yet it's an important part of building out consistent designs — ones that match your current project, or match what's in the user's head for a new product.

The approach is that everything orbits a single JSON (belief state) file that only the model writes to (via structured tool calls). The UI never edits the schema — even where the UI gives the user ways to comment on the design system preview, those comments still go through the model. This is because it's important for the model to reason and update its confidence scores in what the desired design system is, based on all user input.

As the model asks questions, every proposal it suggests has an equivalent patch to the token / JSON state it's maintaining.

The design system preview starts blurred, and as the model increases its confidence in different areas (as it updates them), those areas / components become less blurred.

Novelty: The visual interview approach that both provides suggestions in a visual format (the user can easily answer) AND provides a preview of what it thinks the desired design system is at every turn so the user can steer visually.

---

## 2. Key design decisions & tradeoffs

| Decision                                                  | Why                                                                                              | Tradeoff / cost                                            | How it's handled                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Single writer (model-only belief state)                   | Coherence, one source of truth, picks apply instantly                                            | A control tweak can't change the canvas until a round-trip | Optimistic **pending previews** + debounce                                                 |
| Proposals as token patches, not markup                    | One renderer, fair single-axis comparison, no generated HTML                                     | Model must emit valid patches/targets                      | Strict tool schemas + [client-side target resolution — see §4]                             |
| Model-controlled confidence                               | Drives progressive reveal without a client rubric                                                | Numbers can drift                                          | Rationale-as-forcing-function ("show your work")                                           |
| Progressive blur as the progress bar                      | The preview doubles as the progress indicator — you can see what's decided and what's still open | Blur can hide the thing a proposal is asking about         | The picker sharpens its target component for display only; nothing gets written to state   |
| Fixed turn shape (one `update_beliefs` + one `interact`)  | No multi-step tool-runner loop; every turn looks the same and is easy to validate                | Model can't chain intermediate tool calls                  | Both tool results are acked in one user message; protocol validation rejects anything else |
| Two token namespaces (`--app-*` shell / `--ds-*` preview) | The studio's own styling can't bleed into the design system it's previewing                      | Some duplication (two spacing scales, two palettes)        | Hard rule: the preview subtree never reads `--app-*`, the shell never reads `--ds-*`       |

---

## 3. Iterations (how it evolved today)

- **Planning → phased build.** Concept → implementation architecture → V0 plan restructured for parallel agents.
- **Multi-agent orchestration.** Phase 0 (contracts, serial) → 4 parallel workstreams (renderer / shell / server / export) → Phase 2 integration. This worked well, with one exception: when I created new agents in separate sessions, having another agent contribute to main confused the build orchestrator (I should have at least made those sessions work in a worktree). Once I dealt with this, I just had the main orchestrator spin up new subagents for any work I wanted to happen in parallel.
- **Feedback-driven polish loops.** Several rounds of "make it actually visual".

---

## 4. Learnings

- The live gate surfaced bugs unit tests never could — tool-schema constructs the API rejects (`minimum`/`maximum`, top-level `oneOf`, grammar-size limits) and the model filling a proposal `target` with prose instead of a componentId.
- The preview looked fine while silently using fallback greys because the resolved tokens were never injected — visual verification caught what green tests didn't.
- Showing the actual component with the variant's patch applied is much easier to react to than a swatch with a label. One catch: the picker has to render its target fully sharp even when confidence is still low — otherwise an early color proposal shows up as a blurred placeholder and you can't see the thing it's asking about. That sharpening is display-only and never saved, so the model stays the only writer.
- Creating new sessions (especially ones operating on main) confused the main build orchestrator agent. I had to cancel those and instead use the main orchestrator to spin up new subagents for parallel work. It tended to create these subagents in worktrees and merge them once each was done, so it stayed in charge of main.

---

## 5. What I'd do next

- **Lead fast-follow:** Feature - a "vary again / go bolder" control to regenerate proposal variants along an axis — turning _pick-from-a-batch_ into _drive-the-exploration_.
- **Tune the API calls.** The server is stateless, so the loop resends the full history every turn. Caching breakpoints are already in place to keep that cheap, but I want to confirm cache hits actually hold up in prod as sessions get long — and eventually summarize old turns into the belief state instead of resending everything forever.
- **Improve the schema.** Extend the schema so it covers more of the design-token spec.
- **Improve the agent.** Currently the agent asks a lot of questions, sometimes being a bit too careful when scoring / building its confidence. I'd add different interview strategies: let it take leaps of faith and confirm ("here's what I think you want — is this right?") instead of always asking, so it can make bigger jumps in its understanding.

---

## 6. Logistics

**Time spent:**

- [50 minutes - Fable] Planning. Iterated with agent on concept, then overall implementation plan, then v0 plan, restructuring it for subagents.
- [1 hr - Opus/Sonnet] Initial execution with /goal of V0 implementation plan. Phase 0 was serial, Phase 1 was parallelized across 4 subagents (renderer and preview, interaction shell, loop server, design.md export).
- [10 minutes] While V0 Plan was being implemented, set up Vercel deployment of the app.
- [30-40 minutes - Opus] Polish working alongside the orchestrator / Phase 2 subagent with feedback from what I'm seeing, expanding scope slightly in places, and giving clearer direction / feedback in others.
- [20 minutes] Write up, recording, logistics, etc.
- [20 minutes - Fable] Project audit looking for bugs, visual or functional.

**Tools / model:**
Claude code with Fable for planning. Opus for orchestration. Sonnet for subagents.

**Transcripts:** HTML transcripts of today's key Claude Code sessions live in [`transcripts/`](transcripts/):

- [V0 build orchestrator](transcripts/orchestrator/index.html) — the main session that ran Phase 0 → parallel workstreams → Phase 2 integration.
- [Planning agent](transcripts/planning-agent/index.html) — concept → implementation architecture → V0 plan restructured for parallel agents.
- [Polish agent](transcripts/polish-agent/index.html) — the "make it actually visual" feedback-driven polish loops.
