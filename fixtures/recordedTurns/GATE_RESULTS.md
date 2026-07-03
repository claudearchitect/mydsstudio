# Live-API gate results

Status: **partial (1 of 2 personas committed)** — deliberate V0 scope cut under time pressure.

## What's committed

- **`complianceDashboardInterview/`** — a complete 15-turn interview recorded live against `claude-opus-4-8` via the CLI harness (`npm run cli -- --record`). Committed as a fixture and replayed offline by `src/server/__tests__/recordedInterviewReplay.test.ts` (no test makes a live call).
- The dog-groomer persona was also recorded live, but its re-record (against the two live-only turn-protocol bug fixes below) was truncated during a concurrent-write incident and dropped rather than committed in an inconsistent state.

## What the gate established (live)

The live recording path is proven working end-to-end. Observations from the live recording sessions:

- **Live turns succeed** with the three-tool protocol; `usage.cache_read_input_tokens` was non-zero from turn 2 onward (observed `cache_read ≈ 5754`), confirming prompt-cache hygiene.
- **Protocol enforcement works**: a turn that violated the one-`update_beliefs`+one-`interact` rule was recovered by the single corrective retry.
- **Contradiction → clarify**: a deliberately inconsistent answer (a "very corporate and buttoned-up" pivot mid-interview) triggered a clarifying question, as designed.
- **Confidence climbs** to real design signal (the replay test asserts ≥1 token group reaches ≥0.5).

## Bugs the live gate caught (that mocked tests could not)

These were fixed and committed on `main`:

1. Tool-schema derivation 400s (`minimum`/`maximum`, top-level `oneOf`, `minItems`/`maxItems`, and a strict-mode grammar-size limit on `interact`) — `src/contracts/toJsonSchema.ts`.
2. Multi-turn context assembly not strictly alternating roles.
3. The corrective-retry message omitting `tool_result` acks for the rejected `tool_use` blocks.

## Follow-up

Re-record the dog-groomer persona cleanly and re-enable it in the replay test's `describe.each` to restore the full two-persona gate.
