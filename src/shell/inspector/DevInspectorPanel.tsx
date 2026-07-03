/**
 * Dev inspector panel (V0_PLAN.md Workstream B: "Dev inspector panel
 * showing outgoing normalized messages"). Read-only, dev-only surface:
 * lists every NormalizedMessage the shell has sent this session in order,
 * with its channel-specific fields, so all three channels' shapes can be
 * eyeballed against the frozen contract during development and in the
 * fake-agent gate walkthrough.
 *
 * Deliberately styled as a muted "debug" affordance, not a normal chrome
 * surface a first-time user would mistake for a feature: a dashed top
 * border, a monospace "Debug" eyebrow label, and — the actual fix here —
 * collapsed by default (user feedback: this was expanded on load, reading
 * as raw internals dumped in front of the user before they'd done
 * anything). Still one click away for anyone who does want it.
 */
"use client";

import { useState } from "react";
import type { NormalizedMessage } from "@/contracts";

export interface DevInspectorPanelProps {
  messages: NormalizedMessage[];
}

export function DevInspectorPanel({ messages }: DevInspectorPanelProps) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div
      className="border-t border-dashed border-app-border bg-app-bg-deep/60"
      data-testid="dev-inspector-panel"
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between px-4 py-1.5 text-[10px] uppercase tracking-wide text-app-text-muted/70 hover:text-app-text-muted"
        data-testid="dev-inspector-toggle"
      >
        <span className="flex items-center gap-1.5 font-mono normal-case">
          <span
            className="rounded-app-sm border border-app-text-muted/40 px-1 text-[9px] font-semibold tracking-wider text-app-text-muted/70"
            aria-hidden
          >
            DEBUG
          </span>
          Outgoing messages ({messages.length})
        </span>
        <span>{collapsed ? "▸" : "▾"}</span>
      </button>

      {!collapsed && (
        <div className="max-h-48 overflow-y-auto px-4 pb-3" data-testid="dev-inspector-list">
          {messages.length === 0 && (
            <p className="text-xs text-app-text-muted">No messages sent yet.</p>
          )}
          <ol className="space-y-1">
            {messages.map((message, i) => (
              <li
                key={i}
                className="rounded-app-sm bg-app-bg-input px-2 py-1 font-mono text-[11px] text-app-text-secondary shadow-app-edge"
                data-testid={`dev-inspector-message-${i}`}
                data-channel={message.channel}
              >
                {JSON.stringify(message)}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
