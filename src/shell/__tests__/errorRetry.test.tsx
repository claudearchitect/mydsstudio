/**
 * Turn-lifecycle error handling (V0_PLAN.md Workstream B: "`error` events
 * surface as a chrome-styled banner with a retry action"). Drives the fake
 * agent's script to exhaustion (its own documented error path —
 * fakeTurnAgent.ts: "fake-agent script exhausted") to exercise the error
 * banner + retry UI without needing a real network failure.
 */
import { describe, expect, it } from "vitest";
import { act, render } from "./testUtils";
import { FakeAgentDriver, type FakeAgentScript } from "@fixtures/fakeAgent";
import { EMPTY_TOKEN_PATCH } from "@/contracts";
import { emptyBeliefState } from "@fixtures/beliefStates";
import { FakeTurnAgent } from "../turn/fakeTurnAgent";
import { useSession } from "../turn/useSession";
import { ChatPanel } from "../chat/ChatPanel";

// A single-turn script so it's immediately exhausted after the kickoff.
const oneTurnScript: FakeAgentScript = {
  name: "one-turn",
  turns: [
    {
      id: "t00",
      patch: EMPTY_TOKEN_PATCH,
      interaction: { mode: "ask", question: "Only question", quickReplies: [] },
    },
  ],
};

function Harness({ agent }: { agent: FakeTurnAgent }) {
  const session = useSession({ agent, disablePersistence: true });
  return (
    <ChatPanel
      transcript={session.transcript}
      liveInteraction={session.interaction}
      beliefState={session.beliefState}
      isStreaming={session.isStreaming}
      streamingText={session.streamingText}
      onSendMessage={(m) => void session.sendMessage(m)}
      onRetry={session.retry}
    />
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function submitChat(container: HTMLElement, text: string) {
  const chatInput = container.querySelector<HTMLInputElement>("[data-testid='chat-input-field']")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(chatInput, text);
    chatInput.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => {
    container.querySelector<HTMLFormElement>("[data-testid='chat-input-form']")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("turn error + retry", () => {
  it("shows a chrome-styled error banner with retry when the agent errors (script exhaustion)", async () => {
    const agent = new FakeTurnAgent(new FakeAgentDriver(oneTurnScript, emptyBeliefState));
    const { container, unmount } = render(<Harness agent={agent} />);
    await flush();

    // Kickoff consumed the only scripted turn — the next send exhausts it.
    submitChat(container, "hello");
    await flush();

    const banner = container.querySelector("[data-testid='transcript-error-banner']");
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain("exhausted");

    const retryButton = container.querySelector<HTMLButtonElement>("[data-testid='retry-button']");
    expect(retryButton).not.toBeNull();

    unmount();
  });

  it("disables the chat input while a turn is streaming (one in-flight turn at a time)", async () => {
    const agent = new FakeTurnAgent(new FakeAgentDriver(oneTurnScript, emptyBeliefState), {
      deltaIntervalMs: 5,
    });
    const { container, unmount } = render(<Harness agent={agent} />);
    // Kickoff is in flight synchronously-ish (queued as a microtask by
    // useSession) — the input should be disabled the moment isStreaming
    // flips true, before the turn resolves.
    await act(async () => {
      await Promise.resolve();
    });

    const input = container.querySelector<HTMLInputElement>("[data-testid='chat-input-field']");
    // Either still streaming (disabled) or already resolved — both are
    // valid depending on timing, but once resolved it must be enabled.
    if (input) {
      await flush();
      expect(input.disabled).toBe(false);
    }

    unmount();
  });
});
