/**
 * CLI harness (V0_PLAN.md Workstream C: "play an interview from the
 * terminal (type answers, see interactions as text, dump belief state) —
 * C's full validation environment, independent of A/B").
 *
 * Two modes:
 *   - Live mode (default): requires ANTHROPIC_API_KEY, drives the real
 *     runTurn() against the Claude API, and can optionally record every
 *     turn's raw tool-use content to fixtures/recordedTurns/ for later use
 *     as offline test fixtures (`--record <name>`).
 *   - Mock mode (`--mock <fixture>`): drives runTurn() with a scripted
 *     mock client and NO network calls at all — this is what proves the
 *     "CLI harness runs and, with a mock client, plays a scripted turn
 *     end-to-end and dumps belief state" gate item without an API key.
 *
 * Run via `npm run cli` (see package.json) or directly:
 *   node --experimental-strip-types --no-warnings \
 *     --import ./src/server/cli/register.mjs src/server/cli/harness.ts
 */
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { type BeliefState, type Interaction, type NormalizedMessage } from "@/contracts";
import { runTurn, KICKOFF_INSTRUCTION } from "../turnRunner";
import { getAnthropicClient } from "../anthropicClient";
import type { PriorTurnRecord } from "../contextAssembly";
import { renderNormalizedMessageText } from "../requestSchema";
import type { AnthropicMessagesClient } from "../anthropicClient";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "../../../../");

interface CliArgs {
  mockFixture?: string;
  recordName?: string;
  maxTurns: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { maxTurns: 20 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--mock") {
      args.mockFixture = argv[++i];
    } else if (arg === "--record") {
      args.recordName = argv[++i];
    } else if (arg === "--max-turns") {
      args.maxTurns = Number(argv[++i]) || 20;
    }
  }
  return args;
}

async function loadMockClient(fixtureName: string): Promise<AnthropicMessagesClient> {
  // Fixture modules default-export (or named-export `script`) an array of
  // { deltaTexts, content, usage } entries consumed in order — see
  // fixtures/fakeAgent/scripts/ for the shape convention this mirrors, and
  // src/server/testUtils/mockAnthropicClient.ts for the driver.
  const mod = await import(pathToImportSpecifier(fixtureName));
  const { createMockAnthropicClient } = await import("../testUtils/mockAnthropicClient");
  const script = mod.script ?? mod.default;
  if (!Array.isArray(script)) {
    throw new Error(
      `--mock fixture "${fixtureName}" must export an array named "script" (or a default export) of ScriptedResponse entries`,
    );
  }
  const { client } = createMockAnthropicClient(script);
  return client;
}

function pathToImportSpecifier(fixturePath: string): string {
  const abs = path.isAbsolute(fixturePath) ? fixturePath : path.resolve(REPO_ROOT, fixturePath);
  return abs.endsWith(".ts") || abs.endsWith(".mts") ? "file://" + abs : "file://" + abs + ".ts";
}

function emptySession(): BeliefState {
  return {
    schemaVersion: 1,
    meta: { product: "", audience: "", personality: [] },
    groups: {},
    rationale: [],
    events: [
      {
        id: "e00",
        ts: new Date().toISOString(),
        kind: "session_start",
        payload: {},
      },
    ],
  };
}

function printInteraction(interaction: Interaction): void {
  console.log("");
  if (interaction.mode === "ask") {
    console.log(`AGENT ASKS: ${interaction.question}`);
    if (interaction.quickReplies.length > 0) {
      console.log(
        "  quick replies: " + interaction.quickReplies.map((q) => `[${q.label}]`).join("  "),
      );
    }
  } else {
    console.log(`AGENT PROPOSES (${interaction.caption})`);
    console.log(`  axis: ${interaction.axis.join(", ")}  target: ${interaction.target}`);
    for (const variant of interaction.variants) {
      console.log(`  - ${variant.id}: ${variant.caption}`);
    }
  }
  console.log("");
}

function dumpBeliefState(state: BeliefState): void {
  console.log("--- belief state ---");
  console.log(JSON.stringify({ meta: state.meta, groups: state.groups, rationale: state.rationale }, null, 2));
  console.log("--- events (" + state.events.length + ") ---");
  for (const e of state.events) {
    console.log(`  [${e.id}] ${e.kind}`);
  }
  console.log("--------------------");
}

/**
 * A prompt-then-read-one-line helper built on raw `line` events instead of
 * `readline/promises`'s `rl.question()`. Necessary because `rl.question()`
 * has a known gap with piped (non-TTY) stdin: when the whole input is
 * available immediately, all `line` events can fire before the first
 * `question()` call's internal listener attaches, and the interface's
 * `close` event (fired on EOF) never resolves an already-pending
 * `question()` promise — the process hangs on "unsettled top-level await."
 * Queueing lines as they arrive and resolving a pending waiter (if any)
 * handles both piped and interactive stdin correctly.
 */
function createLineReader(): {
  next: (prompt: string) => Promise<string | null>;
  close: () => void;
} {
  const rl = createInterface({ input: stdin, output: stdout });
  const queue: string[] = [];
  let waiter: ((line: string | null) => void) | null = null;
  let closed = false;

  rl.on("line", (line: string) => {
    if (waiter) {
      const w = waiter;
      waiter = null;
      w(line);
    } else {
      queue.push(line);
    }
  });
  rl.on("close", () => {
    closed = true;
    if (waiter) {
      const w = waiter;
      waiter = null;
      w(null);
    }
  });

  return {
    next(prompt: string): Promise<string | null> {
      stdout.write(prompt);
      if (queue.length > 0) {
        return Promise.resolve(queue.shift()!);
      }
      if (closed) {
        return Promise.resolve(null);
      }
      return new Promise((resolve) => {
        waiter = resolve;
      });
    },
    close(): void {
      rl.close();
    },
  };
}

async function recordTurn(recordName: string, turnIndex: number, payload: unknown): Promise<void> {
  const dir = path.join(REPO_ROOT, "fixtures", "recordedTurns", recordName);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `turn-${String(turnIndex).padStart(2, "0")}.json`);
  await writeFile(file, JSON.stringify(payload, null, 2) + "\n", "utf-8");
  console.log(`  (recorded -> ${path.relative(REPO_ROOT, file)})`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const client = args.mockFixture ? await loadMockClient(args.mockFixture) : getAnthropicClient();

  console.log("=== mydsstudio CLI interview harness ===");
  console.log(args.mockFixture ? `mode: mock (${args.mockFixture})` : "mode: live (ANTHROPIC_API_KEY)");
  if (args.recordName) console.log(`recording turns to fixtures/recordedTurns/${args.recordName}/`);
  console.log("Type your answers; type /state to dump belief state; /quit to exit.\n");

  let state = emptySession();
  const priorTurns: PriorTurnRecord[] = [];
  const reader = createLineReader();

  let turnIndex = 1;
  let latestUserText = KICKOFF_INSTRUCTION;

  try {
    while (turnIndex <= args.maxTurns) {
      let deltaBuffer = "";
      const result = await runTurn({
        client,
        beliefState: state,
        latestUserText,
        priorTurns,
        turnIndex,
        onEvent: (event) => {
          if (event.type === "delta") {
            deltaBuffer += event.text;
          } else if (event.type === "turn") {
            if (deltaBuffer) {
              console.log(`\n[stream] ${deltaBuffer}`);
            }
            printInteraction(event.interaction);
            console.log(
              `  usage: input=${event.usage.inputTokens} output=${event.usage.outputTokens} ` +
                `cache_read=${event.usage.cacheReadInputTokens} cache_creation=${event.usage.cacheCreationInputTokens}`,
            );
          } else if (event.type === "error") {
            console.error(`\n[error] ${event.code}: ${event.message}`);
          }
        },
      });

      if (result.failed) {
        console.error("Turn failed — stopping session.");
        break;
      }

      state = result.beliefState;
      if (result.priorTurnRecord) priorTurns.push(result.priorTurnRecord);

      if (args.recordName) {
        await recordTurn(args.recordName, turnIndex, {
          turnIndex,
          latestUserText,
          toolCalls: result.toolCalls,
          beliefState: state,
        });
      }

      // If the model called export_design_md instead of interact, the
      // session is done — dump final state and exit.
      if (state.events.at(-1)?.kind === "export_design_md") {
        console.log("\nModel signaled export/completion. Final state:");
        dumpBeliefState(state);
        break;
      }

      // Loop on inspection commands (/state) without consuming a turn;
      // the first non-command answer becomes the next turn's input. `null`
      // means stdin closed (EOF) — treat that the same as /quit.
      let answer: string | null;
      for (;;) {
        const line = await reader.next("> ");
        if (line === null) {
          answer = null;
          break;
        }
        answer = line.trim();
        if (answer === "/state") {
          dumpBeliefState(state);
          continue;
        }
        break;
      }
      if (answer === null || answer === "/quit") break;

      const message: NormalizedMessage = { channel: "chat", text: answer };
      latestUserText = renderNormalizedMessageText(message);
      turnIndex += 1;
    }
  } finally {
    reader.close();
  }

  console.log("\nSession ended.");
  dumpBeliefState(state);
}

main().catch((err) => {
  console.error("CLI harness crashed:", err);
  process.exitCode = 1;
});
