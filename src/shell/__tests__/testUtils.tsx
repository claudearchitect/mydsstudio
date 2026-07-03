/**
 * Minimal test utilities standing in for @testing-library/react (not an
 * installed dependency — AGENTS.md / V0_PLAN.md "Do NOT add npm
 * dependencies"). Provides just enough of `renderHook` and `act` to unit
 * test hooks and small components with plain Vitest + jsdom (already
 * configured in vitest.config.ts).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

export { act };

export interface RenderHookResult<T> {
  result: { current: T };
  unmount: () => void;
  rerender: (nextProps?: unknown) => void;
}

/** Renders a hook by mounting a throwaway component that calls it and
 * stashes the latest return value on `result.current`, mirroring RTL's
 * `renderHook` API closely enough for this codebase's needs. */
export function renderHook<T, P = undefined>(
  callback: (props: P) => T,
  initialProps?: P,
): RenderHookResult<T> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root;
  const result = { current: undefined as unknown as T };

  function TestComponent({ hookProps }: { hookProps: P }) {
    result.current = callback(hookProps);
    return null;
  }

  act(() => {
    root = createRoot(container);
    root.render(<TestComponent hookProps={initialProps as P} />);
  });

  return {
    result,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
    rerender: (nextProps?: unknown) => {
      act(() => {
        root.render(<TestComponent hookProps={(nextProps as P) ?? (initialProps as P)} />);
      });
    },
  };
}

export interface RenderResult {
  container: HTMLDivElement;
  unmount: () => void;
}

export function render(ui: React.ReactElement): RenderResult {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(ui);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}
