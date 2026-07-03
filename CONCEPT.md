# mydsstudio — Discovering a design system by interview, not by form

## 1. The problem

Most people — especially non-designers — cannot tell you what their design system should look like. Not because they have no taste, but because the question is posed in the wrong direction. A form that asks "What is your primary color?" or "Serif or sans-serif?" demands **recall**: the ability to produce a design decision from nothing, using vocabulary the person doesn't have. "What's your border radius preference?" is a meaningless question to almost everyone who isn't a designer.

But the same people are excellent at **recognition**. Shown two options, nearly anyone can say which one feels more like them. The gap isn't taste — it's articulation.

The right model is the optometrist exam. The patient never needs to know optics; they just answer "better one, or better two?" over and over, and each comparison narrows the prescription. The expertise lives in the person *choosing which comparison to show next*.

## 2. The core idea

Replace the form with an **investigative interview** in which the AI does the expert's work:

- The AI holds a running **hypothesis** of what your design system is.
- It asks whatever question will most efficiently sharpen that hypothesis — sometimes in words, sometimes by showing you small visual artifacts to pick from.
- As its confidence grows, it **progressively reveals** its current belief as a live rendering of your design system: real components, styled as it thinks you want them.
- The session ends when the AI is confident, not when a fixed script runs out — and it tells you where it's still guessing.

The user never fills in a blank. They react, choose, point, and occasionally explain — all things non-designers are good at.

## 3. The belief-state model

This is what makes the idea rigorous rather than just "a chatbot that asks about design."

A design system is a **latent parameter space**: color palette, typography pairing and scale, spacing density, corner radius, elevation/depth style, contrast level, motion character, illustration style, voice and tone. The interview is a search through that space.

The AI maintains a **belief state**: a current best guess plus a confidence score for each parameter group. Two properties make the interview efficient:

- **One answer updates many parameters.** Semantic answers are extremely high-leverage: "this is a website for a pediatric clinic" collapses enormous regions of the space at once (rules out brutalist contrast, implies warmth, approachable type, soft shapes) before a single visual question is asked. That's why the interview opens with meaning, not aesthetics.
- **Question selection is expected information gain.** The next question targets whatever is currently *high-impact and low-confidence*. This is the precise implementation of "the AI taps into areas where it has less confidence" — not a vibe, a selection criterion. Early on that means broad semantic questions; later it means narrow visual comparisons on specific unresolved axes.

## 4. Question modalities

Different parameters call for different kinds of questions:

- **Natural language** for semantics: audience, industry, brand personality, what the product does, how it should make people feel. This is where the priors come from.
- **Visual picks** for aesthetics: 2–4 rendered options, side by side. Crucially, **minimal rendering is enough** — if the question is about buttons, three buttons suffice; there's no need to compose a full page. Each option varies *one axis* (say, radius or weight) while holding everything else at the current best guess, so the choice is clean and the options stay coherent with each other. This is the optometrist's trick: swap one lens at a time against the current prescription.
- **Real-world anchors** when useful: "closer to Stripe, or closer to Linear?" Named references carry a huge amount of aesthetic information for people who can't name the attributes themselves.
- **Always an escape hatch.** Every question — visual or verbal — includes a "something else" option. The user can reject all the choices, answer in their own words, or say "I don't care about this." Forced choices between wrong options poison the belief state.

## 5. The progressive-reveal visualizer

The user-facing surface is not a transcript and not a settings panel. It is a **live rendering of the AI's current belief**: an evolving canvas of real components — buttons, cards, headings, inputs, badges — shown as they would actually look with the system in play.

Two reveal mechanics work together:

- **Blur and abstraction.** Areas the AI is unsure about appear blurred or as neutral placeholders. As confidence rises, they resolve into sharp, concrete renderings. The user literally watches the system come into focus.
- **Threshold-gated components.** Individual components don't appear at all until the AI's confidence in them crosses a threshold. The canvas starts nearly empty and fills in as the interview proceeds — visible, motivating progress.

The reveal is not decoration; it **is** the feedback loop. When something resolves and it feels wrong, the user points at it — and pointing is the one design-critique modality non-designers excel at. "That button feels too corporate" is a perfectly good belief update, and it arrives precisely because the belief was made visible.

## 6. The output: design.md

The machine artifact produced at the end is a **`design.md`** file (following the google-labs-code spec): a two-layer document with

1. **YAML front matter** — machine-readable design tokens in DTCG style (colors, typography, spacing, radius, elevation, component mappings), and
2. **Markdown prose** — human- and agent-readable sections in the canonical order (Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts) explaining how and why to apply the tokens.

The user never interacts with this file directly — they interact with the visualizer. But the file is what makes the result *usable*: it can be handed to a developer, a coding agent, or a generation tool.

And here is a quiet superpower of the interview format: **the transcript generates the prose layer.** Every token in the output traces back to an answer, a pick, or a reaction — so every value comes with a *why* ("radius is 12px because you consistently chose soft shapes and described the brand as 'friendly, not childish'"). Real design systems chronically lack recorded rationale. This one produces it as a byproduct.

## 7. Handling the hard cases

- **Contradictions → clarify.** Non-designers pick inconsistent things (playful colors, austere typography). When new evidence conflicts with the belief state, the AI doesn't silently resolve it — the contradiction *becomes the next question*: "These two choices pull in different directions; which matters more here?" That moment is where the tool feels genuinely intelligent rather than scripted.
- **Recency wins.** More recent answers carry more weight. Users are allowed — expected — to change their minds as the system comes into focus and they see consequences of earlier choices. The belief state follows them; nothing is locked.
- **Confidence-driven termination.** The session ends when overall confidence crosses a threshold, not after N questions. At the end, the AI explicitly flags what it inferred versus what it confirmed: "I guessed your error-state color from your palette — flag it if it feels off."
- **Avoiding the generic-AI aesthetic.** Left alone, an LLM generating visual options converges on safe, samey, "AI slop" design. The option generator must be explicitly steered to propose *deliberately distinct directions* — three genuinely different answers to the question, not three shades of the same safe choice. Distinct options are also more informative: they produce bigger belief updates per question.

## 8. Architecture sketch (future prototype)

The prototype is genuinely LLM-driven — the intelligence is real, not a scripted decision tree wearing a chat UI.

- **Session state**: a JSON document holding the belief state (current token values per parameter group), a confidence map (score per group), and the interview transcript.
- **Interview loop** (Claude API):
  1. Given the session state, the model selects the next question — modality, target parameter(s), and, for visual questions, 2–4 candidate token sets that differ along the probed axis.
  2. Candidate options are rendered client-side as live HTML/CSS from the candidate tokens (no image generation needed — the artifacts *are* components).
  3. The user's response (pick, free text, or "something else") goes back to the model, which returns an updated belief state and confidence map.
  4. The visualizer re-renders from the belief state; components blur, sharpen, or newly appear per the confidence map.
- **Latency masking**: while the user considers the current question, the next most-likely question is pre-generated in the background.
- **Output**: when confidence crosses the finish threshold, the model emits the `design.md` — tokens from the belief state, prose synthesized from the transcript.

## 9. Risks and tradeoffs

- **Choice overload.** More options per question feels richer but decides worse. Cap at 2–4, always with the escape hatch.
- **Latency.** Real LLM-driven option generation takes seconds; a laggy interview kills the "conversation with an expert" feel. Pre-generation (above) and minimal rendering both attack this.
- **Cost of real intelligence.** A scripted flow would be cheaper and more predictable — but it can't do information-gain question selection, contradiction detection, or free-text interpretation, which are the whole point. The tradeoff is accepted deliberately.
- **Users with no opinion.** Some users shrug at everything ("just make it nice"). Fallback: stop asking and start proposing — pick one strong, opinionated default direction and iterate purely by reaction. Reacting to something concrete is easier than choosing among abstractions.
- **Order effects.** Early answers set priors that shape later options. Recency weighting and revisitability (Section 7) keep early answers from becoming a cage.

## 10. Extensions

Documented here, not built in the prototype:

- **Bring-your-own-context.** The agent shouldn't have to start from scratch when the user doesn't. Let users seed the belief state: point the agent at an existing website (it pulls colors, type, spacing directly from the live styles), a Figma file, a logo, or written brand guidelines. Initial confidence starts high where the evidence is strong, and the interview becomes *refinement and gap-filling* rather than discovery — fewer questions, faster convergence, same mechanics.
- **Multi-brand / sub-brand systems**: run the interview against an existing design.md as the prior, diverging only where the sub-brand differs.
- **Export targets**: emit Tailwind config, CSS custom properties, or Figma tokens derived from the design.md front matter.
- **The interview as an ongoing relationship.** A design system isn't finished at v1. Later, short mini-interviews ("you're adding a data-heavy dashboard — let's resolve table density and chart colors") extend the same belief state instead of starting over. The design.md becomes a living artifact with an interrogable history of why everything is the way it is.
