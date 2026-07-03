# Workstream C — Agent loop (server)

The interviewer agent's system prompt, the three-tool protocol wiring, `POST /api/turn`, and a headless CLI harness. See [V0_PLAN.md](../../V0_PLAN.md) ("Workstream C — Agent loop") and [IMPLEMENTATION.md](../../IMPLEMENTATION.md) (#3, #7) for the architecture this implements.

## Layout

| File | Purpose |
|---|---|
| `systemPrompt.ts` | The static, byte-identical system prompt (role, parameter-space schema, confidence semantics, interview strategy). |
| `tools.ts` | Builds the Anthropic `tools` array from `@/contracts`' `buildToolDefinitions()`, attaching descriptions + `strict: true` in a fixed order. |
| `anthropicClient.ts` | Lazily constructs the real SDK client from `ANTHROPIC_API_KEY`; defines the narrow `AnthropicMessagesClient` interface the rest of the module depends on (this is the injection seam for mocking). |
| `contextAssembly.ts` | Assembles `{system, messages}` for one turn: frozen system prompt + belief state + event tail + replayed prior-turn tool_use/tool_result pairs. |
| `eventLog.ts` | Event id generation + verbatim/summarized event-log tail splitting. |
| `protocolValidation.ts` | Validates exactly one `update_beliefs` + one of (`interact` \| `export_design_md`) per turn; builds the corrective-retry message. |
| `errorMapping.ts` | Maps the SDK's typed exception chain to `TurnErrorCode`. |
| `logging.ts` | Per-turn dev console logging of token usage + latency. |
| `turnRunner.ts` | Orchestrates one turn: assemble → call → validate → (retry once) → apply patch → emit SSE events. No tool-runner loop — one call to Claude per turn, at most two on a protocol-violation retry. |
| `requestSchema.ts` | Zod schema for `/api/turn`'s request body + NormalizedMessage → prompt-text rendering. |
| `../app/api/turn/route.ts` | The Next.js route handler — thin wrapper streaming SSE frames per `src/contracts/turnWireFormat.ts`. |
| `testUtils/` | Mock Anthropic client, mock-Message builder, `toolUseBlock()` helper — used by both Vitest and the CLI harness's `--mock` mode. |
| `cli/` | The CLI harness (`harness.ts`) plus a small zero-dependency loader (`tsLoader.mjs`/`register.mjs`) so it runs under `node --experimental-strip-types` with no new npm packages. |

## Running the CLI harness

```sh
npm run cli -- --mock fixtures/recordedTurns/cliScripts/twoTurnDemo --max-turns 5
```

Type answers at the `>` prompt; `/state` dumps the current belief state without consuming a turn; `/quit` ends the session. Runs with **zero network calls** — `--mock` drives a scripted `ScriptedResponse[]` (see `fixtures/recordedTurns/cliScripts/twoTurnDemo.ts` for the shape) through the exact same `runTurn()` code path production uses.

Live mode (once `ANTHROPIC_API_KEY` is set — see `.env.example` / `ANTHROPIC_API_KEY=... npm run cli -- ...`):

```sh
ANTHROPIC_API_KEY=sk-ant-... npm run cli -- --max-turns 15 --record dogGroomerInterview
```

`--record <name>` writes each turn's `{turnIndex, latestUserText, toolCalls, beliefState}` to `fixtures/recordedTurns/<name>/turn-NN.json` as it plays — this is how to capture the two real interviews the V0 gate calls for.

### Why a custom loader instead of ts-node/tsx

The ground rules for this workstream disallow adding npm dependencies. Node 22's built-in `--experimental-strip-types` handles plain `.ts` files but not (a) extensionless/`@/`-aliased imports the way a bundler resolves them, or (b) `.tsx` (JSX isn't strippable, only type syntax is). `cli/tsLoader.mjs` is a ~60-line `module.register()` hook that resolves both gaps for exactly the files under `src/` — see the comments in that file for the full rationale, including why the one `.tsx` file transitively reachable from `@/contracts` (`renderComponent.tsx`, irrelevant to a headless CLI) is stubbed out only inside this loader's process.

## Live-API gate items — BLOCKED on `ANTHROPIC_API_KEY`

No key is available in this environment. Everything above is built and tested so it is fully functional the moment a key exists; these specific V0_PLAN.md gate items cannot be verified without one and are **not faked**:

| Gate item | Command to run once a key exists |
|---|---|
| Record 2 full real interviews as committed fixtures | `ANTHROPIC_API_KEY=... npm run cli -- --max-turns 15 --record interview1` (repeat with a second persona for `interview2`); then `git add fixtures/recordedTurns/interview1 fixtures/recordedTurns/interview2` |
| Two contrasting personas ("booking app for dog groomers", "B2B compliance dashboard") converge to different belief states with climbing confidence | Run the CLI harness live once per persona (as above), typing that persona's answers; compare the two recorded `beliefState`s across turns |
| A deliberately inconsistent answer triggers a clarifying question | Mid-session, give an answer that contradicts an earlier stated preference (e.g. say "playful" early, then "very corporate and buttoned-up" later) and confirm the next `interact` is an `ask` referencing the earlier claim |
| A `control` message is acknowledged and ripples where warranted | Send a `NormalizedMessage` with `channel: "control"` (e.g. via a small script calling `runTurn` directly, or once Workstream B is wired) and confirm the resulting patch touches the target token plus any token it should logically affect (e.g. contrast on a color change) |
| No turn violates the protocol post-retry | Watch the CLI's turn log lines (`retried=true/false`) across a full live session; `retried=true` followed by a normal `turn` event (not an `error`) is expected and fine — a `protocol_violation` error event is not |
| `cache_read_input_tokens > 0` from turn 2 onward | Watch the CLI's per-turn log line (`logging.ts`'s `logTurn`) — `cache_read=` should be nonzero starting turn 2 |
| Median turn latency under ~8s | The CLI logs `latency=Nms` per turn; take the median across a session |

## Offline gate (this workstream, verified)

- `npm test` — green, mocked/recorded fixtures only, no live calls (`src/server/__tests__/`).
- `npm run build` — succeeds (`next build`, including the TypeScript pass).
- `npm run lint` — no errors.
- CLI harness runs end-to-end with `--mock` and dumps belief state (see above).
- Protocol enforcement + one corrective retry: `src/server/__tests__/turnRunner.test.ts` ("runTurn — protocol enforcement + retry").
- Patch application from a recorded fixture: `fixtures/recordedTurns/handWrittenOpeningTurn.ts` (hand-written, not live-recorded — see that file's header comment) exercised in `src/server/__tests__/turnRunner.test.ts` and `protocolValidation.test.ts`.
- System-prompt byte-stability across turns: `src/server/__tests__/contextAssembly.test.ts`.
