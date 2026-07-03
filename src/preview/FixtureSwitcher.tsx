/**
 * Dev-only fixture switcher (V0_PLAN.md Workstream A: "Dev-only fixture
 * switcher UI cycling the confidence fixtures"). Cycles through the
 * confidence fixtures (empty, 0.1, 0.4, 0.7, 0.95) so the reveal-state /
 * transition gate can be checked by hand: 0.1 ~= empty, 0.4 partially
 * blurred, 0.95 all sharp, transitions smooth in between.
 *
 * Not part of the frozen contracts — purely a dev harness. Safe to render
 * inside the Studio shell's preview pane during development; excluded from
 * anything resembling a "production" build path is a P2 integration
 * concern, not this workstream's.
 */
"use client";

import { useState } from "react";
import type { BeliefState } from "@/contracts";
import {
  emptyBeliefState,
  confidence01,
  confidence04,
  confidence07,
  confidence095,
} from "@fixtures/beliefStates";
import { PreviewPanel } from "./PreviewPanel";

const FIXTURES: { label: string; state: BeliefState }[] = [
  { label: "empty", state: emptyBeliefState },
  { label: "0.1", state: confidence01 },
  { label: "0.4", state: confidence04 },
  { label: "0.7", state: confidence07 },
  { label: "0.95", state: confidence095 },
];

export function FixtureSwitcher() {
  const [index, setIndex] = useState(0);
  const current = FIXTURES[index];

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
      data-testid="fixture-switcher"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderBottom: "1px solid var(--app-border)",
          background: "var(--app-bg-raised)",
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: "var(--app-text-muted)",
            marginRight: 4,
          }}
        >
          fixture:
        </span>
        {FIXTURES.map((f, i) => (
          <button
            key={f.label}
            type="button"
            data-testid={`fixture-btn-${f.label}`}
            onClick={() => setIndex(i)}
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 9999,
              border: "1px solid var(--app-border)",
              background:
                i === index ? "var(--app-accent)" : "var(--app-bg-input)",
              color: i === index ? "#ffffff" : "var(--app-text-secondary)",
              cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <PreviewPanel state={current.state} />
      </div>
    </div>
  );
}
