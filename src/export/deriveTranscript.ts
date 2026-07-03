/**
 * Best-effort projection of `BeliefState.events` into a `Transcript`.
 * `BeliefEvent.payload` is `unknown` at the contract layer (by design —
 * NormalizedMessage/tool-input schemas own the real shapes), so this reads
 * defensively and skips anything that doesn't look like the shapes
 * Workstream B/C actually emit (see `src/contracts/message.ts`,
 * `src/contracts/interaction.ts`, and the confidence fixtures).
 *
 * This is a convenience for callers (the export UI, tests) that only have a
 * `BeliefState` and no separately-tracked transcript. `serializeDesignMd`
 * itself takes `transcript` as an explicit argument and never calls this.
 */
import type { BeliefState } from "@/contracts";
import type { Transcript } from "./types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function deriveTranscript(state: BeliefState): Transcript {
  const out: Transcript = [];

  for (const event of state.events) {
    const payload = event.payload;
    if (!isRecord(payload)) continue;

    if (event.kind === "message" && typeof payload.text === "string") {
      out.push({ speaker: "user", text: payload.text });
      continue;
    }

    if (event.kind === "interact") {
      if (payload.mode === "ask" && typeof payload.question === "string") {
        out.push({ speaker: "agent", text: payload.question });
      } else if (payload.mode === "propose" && typeof payload.caption === "string") {
        out.push({ speaker: "agent", text: payload.caption });
      }
    }
  }

  return out;
}
