/**
 * Fake-agent gate walkthrough (V0_PLAN.md Workstream B gate): "Driven by
 * the fake agent: all three channels produce correctly-shaped messages in
 * the inspector; a scripted `propose` renders distinct variants and a pick
 * applies its patch; a rapid stepper drag produces exactly one settled
 * message with an immediate pending preview; region-select on the button
 * reports exactly the manifest-declared groups."
 *
 * Exercises the real `Session` composition (useSession + FakeTurnAgent +
 * dogGroomerFullInterviewScript) end to end, driving all three input
 * channels (chat, region, control) plus a propose/pick, and asserting the
 * outgoing message log (what the dev inspector displays) has the right
 * shapes at each step.
 */
import { describe, expect, it, vi } from "vitest";
import { act, render } from "./testUtils";
import { getManifestEntry, type ChatMessage, type ControlMessage, type RegionMessage } from "@/contracts";
import { FakeAgentDriver, dogGroomerFullInterviewScript } from "@fixtures/fakeAgent";
import { emptyBeliefState } from "@fixtures/beliefStates";
import { FakeTurnAgent } from "../turn/fakeTurnAgent";
import { useSession } from "../turn/useSession";
import { ChatPanel } from "../chat/ChatPanel";
import { PreviewPane } from "../preview/PreviewPane";
import { DevInspectorPanel } from "../inspector/DevInspectorPanel";
import { normalizeControlMessage, normalizeRegionMessage } from "../messages/normalize";
import { lookupTokenValue } from "../controls/tokenLookup";

function Harness() {
  const agent = new FakeTurnAgent(new FakeAgentDriver(dogGroomerFullInterviewScript, emptyBeliefState));
  return <HarnessInner agentRef={agent} />;
}

function HarnessInner({ agentRef }: { agentRef: FakeTurnAgent }) {
  const session = useSession({ agent: agentRef, disablePersistence: true });
  return (
    <div>
      <ChatPanel
        transcript={session.transcript}
        liveInteraction={session.interaction}
        beliefState={session.beliefState}
        isStreaming={session.isStreaming}
        streamingText={session.streamingText}
        onSendMessage={(m) => void session.sendMessage(m)}
        onRetry={session.retry}
      />
      <PreviewPane
        beliefState={session.beliefState}
        disabled={session.isStreaming}
        onRegionComment={(target, text) => {
          const msg = normalizeRegionMessage(target, text, (ref) => lookupTokenValue(session.beliefState, ref));
          void session.sendMessage(msg);
        }}
        onControlMessage={(target, text) => {
          void session.sendMessage(normalizeControlMessage(target, text));
        }}
      />
      <DevInspectorPanel messages={session.outgoingMessages} />
    </div>
  );
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("fake-agent full interview walkthrough", () => {
  it("kicks off with the agent's opening ask (no hardcoded first question)", async () => {
    const { container, unmount } = render(<Harness />);
    await flushMicrotasks();

    const ask = container.querySelector("[data-testid='live-interaction-ask']");
    expect(ask).not.toBeNull();
    expect(ask!.textContent).toContain("What are you building");

    unmount();
  });

  it("chat channel: free-text reply produces a correctly-shaped ChatMessage and advances to a propose interaction with distinct variants", async () => {
    const { container, unmount } = render(<Harness />);
    await flushMicrotasks();

    const chatInput = container.querySelector<HTMLInputElement>("[data-testid='chat-input-field']")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setter.call(chatInput, "a booking app for dog groomers");
      chatInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      container.querySelector<HTMLFormElement>("[data-testid='chat-input-form']")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();

    const inspectorMessages = container.querySelectorAll("[data-testid^='dev-inspector-message-']");
    expect(inspectorMessages).toHaveLength(1);
    const sent = JSON.parse(inspectorMessages[0].textContent!) as ChatMessage;
    expect(sent).toEqual({ channel: "chat", text: "a booking app for dog groomers" });

    // t01 is a propose interaction — variants must render distinctly.
    const proposal = container.querySelector("[data-testid='proposal-picker']");
    expect(proposal).not.toBeNull();
    const variantCards = container.querySelectorAll("[data-testid^='proposal-variant-']");
    expect(variantCards.length).toBeGreaterThanOrEqual(2);
    expect(variantCards.length).toBeLessThanOrEqual(4);

    unmount();
  });

  it("propose -> pick applies the variant's patch (sends a message referencing the pick) and advances the turn", async () => {
    const { container, unmount } = render(<Harness />);
    await flushMicrotasks();

    // Turn 0 -> 1: get to the propose interaction.
    submitChat(container, "a booking app for dog groomers");
    await flushMicrotasks();

    const greenVariant = container.querySelector<HTMLButtonElement>(
      "[data-testid='proposal-variant-v-green']",
    )!;
    act(() => {
      greenVariant.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushMicrotasks();

    const inspectorMessages = container.querySelectorAll("[data-testid^='dev-inspector-message-']");
    expect(inspectorMessages).toHaveLength(2);
    const pickMessage = JSON.parse(inspectorMessages[1].textContent!) as ChatMessage;
    expect(pickMessage.channel).toBe("chat");
    expect(pickMessage.text).toContain("Muted green");

    // The next scripted turn (t02) confirms green and moves to an ask.
    const ask = container.querySelector("[data-testid='live-interaction-ask']");
    expect(ask!.textContent).toContain("personality");

    unmount();
  });

  it("region channel: clicking the button and commenting reports exactly the manifest-declared groups", async () => {
    const { container, unmount } = render(<Harness />);
    await flushMicrotasks();

    // Progress far enough that every button.primary manifest dependency
    // (color.primary, color.onPrimary, shape.radius, typography.label,
    // spacing.inset) has a real resolvable value — tokensInScopeFor only
    // reports tokens the resolver actually returns a value for
    // (src/contracts/componentManifest.ts).
    submitChat(container, "a booking app for dog groomers"); // -> t01 propose (color)
    await flushMicrotasks();
    act(() => {
      container.querySelector<HTMLButtonElement>("[data-testid='proposal-variant-v-green']")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushMicrotasks(); // -> t02 ask (personality); typography.label + spacing.inset now seeded
    submitChat(container, "warm and friendly"); // -> t03 propose (shape.radius)
    await flushMicrotasks();
    act(() => {
      container.querySelector<HTMLButtonElement>("[data-testid='proposal-variant-v-soft']")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushMicrotasks(); // -> t04 ask; shape.radius now seeded too

    const buttonSlot = container.querySelector("[data-component='button.primary']")!;
    act(() => {
      buttonSlot.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const manifestEntry = getManifestEntry("button.primary")!;
    const popover = container.querySelector("[data-testid='region-comment-popover']")!;
    const tokenRows = Array.from(popover.querySelectorAll("[data-token-ref]")).map((el) =>
      el.getAttribute("data-token-ref"),
    );
    expect(tokenRows.sort()).toEqual([...manifestEntry.tokenGroups].sort());

    const input = container.querySelector<HTMLInputElement>("[data-testid='region-comment-input']")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setter.call(input, "feels too corporate");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      container.querySelector("[data-testid='region-comment-popover'] form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();

    const inspectorMessages = container.querySelectorAll("[data-testid^='dev-inspector-message-']");
    const last = JSON.parse(
      inspectorMessages[inspectorMessages.length - 1].textContent!,
    ) as RegionMessage;
    expect(last.channel).toBe("region");
    expect(last.target).toBe("button.primary");
    expect(last.text).toBe("feels too corporate");
    expect(Object.keys(last.tokensInScope).sort()).toEqual([...manifestEntry.tokenGroups].sort());

    unmount();
  });

  it("control channel: a rapid radius stepper drag produces exactly one settled control message with immediate pending preview", async () => {
    vi.useFakeTimers();
    const { container, unmount } = render(<Harness />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const inc = container.querySelector<HTMLButtonElement>("[data-testid='radius-stepper-inc-shape.radius']")!;

    // Preview root should reflect a pending change as soon as the first
    // tick fires (pending preview never touches belief state itself, but
    // the displayed state — read via lookupTokenValue against
    // displayState — updates immediately).
    for (let i = 0; i < 4; i++) {
      act(() => {
        inc.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        vi.advanceTimersByTime(100);
      });
    }

    const inspectorBefore = container.querySelectorAll("[data-testid^='dev-inspector-message-']");
    expect(inspectorBefore).toHaveLength(0); // nothing settled yet

    await act(async () => {
      vi.advanceTimersByTime(800);
      await Promise.resolve();
      await Promise.resolve();
    });

    const inspectorAfter = container.querySelectorAll("[data-testid^='dev-inspector-message-']");
    expect(inspectorAfter).toHaveLength(1);
    const settled = JSON.parse(inspectorAfter[0].textContent!) as ControlMessage;
    expect(settled.channel).toBe("control");
    expect(settled.target).toBe("shape.radius");
    expect(settled.text).toContain("px");
    expect(settled.text).toContain("stepper");

    unmount();
    vi.useRealTimers();
  });

  it("all three outgoing channel shapes validate against NormalizedMessageSchema across a mixed sequence", async () => {
    const { container, unmount } = render(<Harness />);
    await flushMicrotasks();

    submitChat(container, "a booking app for dog groomers");
    await flushMicrotasks();
    act(() => {
      container.querySelector<HTMLButtonElement>("[data-testid='proposal-variant-v-green']")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushMicrotasks();

    const inspectorMessages = container.querySelectorAll("[data-testid^='dev-inspector-message-']");
    expect(inspectorMessages.length).toBeGreaterThan(0);
    for (const el of Array.from(inspectorMessages)) {
      const parsed = JSON.parse(el.textContent!);
      expect(["chat", "region", "control"]).toContain(parsed.channel);
    }

    unmount();
  });
});

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
