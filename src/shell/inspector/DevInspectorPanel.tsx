/**
 * Dev inspector panel (V0_PLAN.md Workstream B: "Dev inspector panel
 * showing outgoing normalized messages"). Read-only, dev-only surface:
 * lists every NormalizedMessage the shell has sent this session in order,
 * with its channel-specific fields, so all three channels' shapes can be
 * eyeballed against the frozen contract during development and in the
 * fake-agent gate walkthrough.
 */
"use client";

import { useState } from "react";
import type { NormalizedMessage } from "@/contracts";

export interface DevInspectorPanelProps {
  messages: NormalizedMessage[];
}

export function DevInspectorPanel({ messages }: DevInspectorPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className="border-t border-app-border bg-app-bg-deep"
      data-testid="dev-inspector-panel"
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between px-4 py-2 text-xs text-app-text-muted hover:text-app-text"
        data-testid="dev-inspector-toggle"
      >
        <span>Outgoing messages ({messages.length})</span>
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
                className="rounded-app-sm border border-app-border bg-app-bg-input px-2 py-1 font-mono text-[11px] text-app-text-secondary"
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
