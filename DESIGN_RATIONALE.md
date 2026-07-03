# Design Rationale — MyDS Studio

**One-liner:** A design system you discover by conversation, not by filling out a form.

**The brief it answers:** creative leverage — real control over iteration, variation, and refinement, not a "generate" button.

---

## 1. Approach & what makes it novel

A user with no or limited design background is better able to respond to a series of questions (especially if they're visual in nature) than to fill out a form about their design system. Prior: users with limited design experience lack the design vocabulary to define what their design system is, yet's its an important part of building out consistent designs that match your current project or match what's in the user's head for a new desired product.

The approach is that everything orbits a single JSON (belief state) file that only the model writes to (via structured tool calls). The UI never edits the schema, even as the UI provides ways the user can comment on the design system previewer, they still go through the model. This is because it's important for the model to reason and update it's current confidence scores in what the desired design system is based on all user input.

As the model asks questions, every proposal it suggests has an eqiuvelant patch to the token / JSON state that it's mainintaing.

The design system preview, starts blurred, and as the model increases its confidence in different areas (as its updating them), the area / components becomes less blurred.

Novelty: The visual interview approach that both provides suggestions in a visual format (the user can easily answer) AND provides a preview of what it thinks the desired design system is at every turn so the user can steer visually.

---

## 2. Key design decisions & tradeoffs

| Decision                                | Why                                                          | Tradeoff / cost                                            | How it's handled                                               |
| --------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------- |
| Single writer (model-only belief state) | Coherence, one source of truth, picks apply instantly        | A control tweak can't change the canvas until a round-trip | Optimistic **pending previews** + debounce                     |
| Proposals as token patches, not markup  | One renderer, fair single-axis comparison, no generated HTML | Model must emit valid patches/targets                      | Strict tool schemas + [client-side target resolution — see §4] |
| Model-controlled confidence             | Drives progressive reveal without a client rubric            | Numbers can drift                                          | Rationale-as-forcing-function ("show your work")               |

---

## 3. Iterations (how it evolved today)

Rough narrative of the build arc — keep it honest.

- **Planning → phased build.** Concept → implementation architecture → V0 plan restructured for parallel agents.
- **Multi-agent orchestration.** Phase 0 (contracts, serial) → 4 parallel workstreams (renderer / shell / server / export) → Phase 2 integration. This worked well with the exception when I tried to create new agents in a different session, that confused the main build orchestrator having another agent contribute to main (I should have made the new sessions go into a worktree at the very least). Once I dealt with this, I proceeded to just have the main orchestrator spin up new subagents for new work I wanted to happen in parallel.
- **Feedback-driven polish loops.** Several rounds of "make it actually visual".

---

## 4. Learnings

- **Mocked tests can't catch live-API contract reality.** The live gate surfaced bugs unit tests never could — tool-schema constructs the API rejects (`minimum`/`maximum`, top-level `oneOf`, grammar-size limits) and the model filling a proposal `target` with prose instead of a componentId.
- **"It renders" ≠ "it renders the real design."** The preview looked fine while silently using fallback greys because the resolved tokens were never injected — visual verification caught what green tests didn't.
- **Visual reasoning needs real components, not labels.**
- **Orchestrating parallel agents:** Create new sessions (especially ones operating on main) confused the main build orchestrator agent. I had to cancel those and instead use the main orchestrator to spin up new subagents for paralell work I wanted to happen. It tended to create these subagents in worktrees and then merge them once the subagent was done, so it was in charage of main.

---

## 5. What I'd do next

- **Lead fast-follow:** Feature - a "vary again / go bolder" control to regenerate proposal variants along an axis — turning _pick-from-a-batch_ into _drive-the-exploration_.
- **Tune the API calls** It seems the main agent loop is sending the entire history on every go without caching. This slows things down as turns progress and increases costs. Use caching here.

---

## 6. Logistics

Time spent:

- [50 minutes] Planning. Iterated with agent on concept, then overall implementation plan, then v0 plan, restructuring it for subagents.
- [1 hr] Initial execution with /goal of V0 implementation plan . Phase 0 was serial, Phase 1 was parallelized across 4 subagents (renderer and preview, interaction shell, loop server, design.md export).
- [10 minutes] While V0 Plan was being implemented, setup vercel deployment of the app.
- [30-40 minutes] Polish working alongside the orchestrator / Phase 2 subagent with feedback from what I'm seeing, expanding scope slighly in places, and giving clearer direction / feedback in others.
- [20 minutes] Write up, recording, logistics, etc.

- **Tools / model:**
  Claude code with Fable for planning. Opus for orchestration. Sonnet for subagents.

- **Transcripts:**
