/**
 * Unit tests for the sessions rail: the localStorage-backed index helper
 * (sessionsIndex.ts) and the presentational SessionsRail component. Uses
 * the repo's hand-rolled render/act helper (testUtils.tsx) — no
 * @testing-library/react, per AGENTS.md.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render } from "@/shell/__tests__/testUtils";
import { SessionsRail } from "../SessionsRail";
import {
  listSessions,
  recordSession,
  removeSession,
  SESSIONS_INDEX_KEY,
  type SessionSummary,
} from "../sessionsIndex";

function summary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: "session-1",
    title: "Untitled session",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("sessionsIndex", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("recordSession then listSessions returns the summary", () => {
    const s = summary();
    recordSession(s);
    const all = listSessions();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(s);
  });

  it("a second recordSession with the same id upserts (no duplicate)", () => {
    recordSession(summary({ title: "First" }));
    recordSession(summary({ title: "Second" }));
    const all = listSessions();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe("Second");
  });

  it("removeSession removes it", () => {
    recordSession(summary());
    expect(listSessions()).toHaveLength(1);
    removeSession("session-1");
    expect(listSessions()).toHaveLength(0);
  });

  it("listSessions returns newest first", () => {
    recordSession(summary({ id: "a", updatedAt: "2020-01-01T00:00:00.000Z" }));
    recordSession(summary({ id: "b", updatedAt: "2024-01-01T00:00:00.000Z" }));
    const all = listSessions();
    expect(all.map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("returns [] on malformed stored JSON", () => {
    window.localStorage.setItem(SESSIONS_INDEX_KEY, "{not valid json");
    expect(listSessions()).toEqual([]);
  });
});

describe("SessionsRail", () => {
  it("renders one item per session", () => {
    const sessions = [summary({ id: "a" }), summary({ id: "b" })];
    const { container, unmount } = render(
      <SessionsRail
        sessions={sessions}
        activeId={null}
        onSelect={() => {}}
        onNewSession={() => {}}
      />,
    );
    expect(container.querySelector("[data-testid='session-item-a']")).not.toBeNull();
    expect(container.querySelector("[data-testid='session-item-b']")).not.toBeNull();
    unmount();
  });

  it("clicking New session calls onNewSession", () => {
    const onNewSession = vi.fn();
    const { container, unmount } = render(
      <SessionsRail
        sessions={[]}
        activeId={null}
        onSelect={() => {}}
        onNewSession={onNewSession}
      />,
    );
    const btn = container.querySelector("[data-testid='sessions-new']") as HTMLElement;
    act(() => {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onNewSession).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("clicking a session item calls onSelect with its id", () => {
    const onSelect = vi.fn();
    const sessions = [summary({ id: "a" }), summary({ id: "b" })];
    const { container, unmount } = render(
      <SessionsRail
        sessions={sessions}
        activeId={null}
        onSelect={onSelect}
        onNewSession={() => {}}
      />,
    );
    const btn = container.querySelector("[data-testid='session-item-b']") as HTMLElement;
    act(() => {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledWith("b");
    unmount();
  });

  it("marks the active item distinctly", () => {
    const sessions = [summary({ id: "a" }), summary({ id: "b" })];
    const { container, unmount } = render(
      <SessionsRail
        sessions={sessions}
        activeId="b"
        onSelect={() => {}}
        onNewSession={() => {}}
      />,
    );
    const activeItem = container.querySelector("[data-testid='session-item-b']");
    const inactiveItem = container.querySelector("[data-testid='session-item-a']");
    expect(activeItem?.getAttribute("data-active")).toBe("true");
    expect(inactiveItem?.getAttribute("data-active")).toBe("false");
    expect(
      container.querySelector("[data-testid='session-item-b-active-dot']"),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-testid='session-item-a-active-dot']"),
    ).toBeNull();
    unmount();
  });

  it("shows a muted empty-state line when sessions is empty", () => {
    const { container, unmount } = render(
      <SessionsRail
        sessions={[]}
        activeId={null}
        onSelect={() => {}}
        onNewSession={() => {}}
      />,
    );
    expect(container.querySelector("[data-testid='sessions-empty']")).not.toBeNull();
    unmount();
  });
});
