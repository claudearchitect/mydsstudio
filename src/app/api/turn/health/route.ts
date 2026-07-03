/**
 * GET /api/turn/health — a tiny, key-safe capability probe the client uses
 * to decide whether the live turn agent is usable (Phase 2: "expose demo
 * mode as ... the automatic fallback when ANTHROPIC_API_KEY/live /api/turn
 * is unavailable, so someone can clone and run the demo with zero setup").
 *
 * Returns only a boolean — never the key, never any part of it (AGENTS.md:
 * "the key must never reach the client — only src/server/ reads it"). Safe
 * to call from a client component before attempting a real turn.
 */
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const available = Boolean(process.env.ANTHROPIC_API_KEY);
  return Response.json({ available });
}
