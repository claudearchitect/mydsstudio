"use client";

/**
 * Self-contained export UI (V0_PLAN.md Workstream D: "Export UI component
 * ... mountable anywhere (Phase 2 wires it into the shell) — don't depend on
 * shell internals"). Deliberately has zero dependency on `src/shell/` —
 * no `--app-*` tokens, no shell components/context. Inline styles only, so
 * it renders sanely dropped into any container. Phase 2 may re-skin it.
 */
import { useMemo, useState } from "react";
import type { BeliefState } from "@/contracts";
import { deriveTranscript } from "./deriveTranscript";
import { serializeDesignMd } from "./serializeDesignMd";
import type { Transcript } from "./types";

export interface ExportPanelProps {
  state: BeliefState;
  /** Optional explicit transcript; falls back to a best-effort projection
   * of `state.events` via `deriveTranscript` when omitted. */
  transcript?: Transcript;
  /** Download filename. Defaults to "design.md". */
  filename?: string;
}

function download(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportPanel({ state, transcript, filename = "design.md" }: ExportPanelProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  const designMd = useMemo(
    () => serializeDesignMd(state, transcript ?? deriveTranscript(state)),
    [state, transcript],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(designMd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. non-secure context) — silently
      // no-op; "view raw" + manual select-all remains available.
    }
  };

  return (
    <div
      data-export-panel
      style={{
        fontFamily: "ui-sans-serif, -apple-system, 'Segoe UI', sans-serif",
        fontSize: 14,
        border: "1px solid #d9d7cf",
        borderRadius: 10,
        padding: 16,
        background: "#faf9f5",
        color: "#2b2a26",
        maxWidth: 720,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <strong style={{ fontSize: 15 }}>Export design.md</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            style={buttonStyle(false)}
          >
            {showRaw ? "Hide raw" : "View raw"}
          </button>
          <button type="button" onClick={handleCopy} style={buttonStyle(false)}>
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={() => download(filename, designMd)}
            style={buttonStyle(true)}
          >
            Download {filename}
          </button>
        </div>
      </div>

      {showRaw && (
        <pre
          data-export-raw
          style={{
            marginTop: 12,
            padding: 12,
            background: "#1f1e1c",
            color: "#f5f4ef",
            borderRadius: 8,
            overflow: "auto",
            maxHeight: 480,
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {designMd}
        </pre>
      )}
    </div>
  );
}

function buttonStyle(primary: boolean): React.CSSProperties {
  return {
    fontSize: 13,
    padding: "6px 12px",
    borderRadius: 6,
    border: primary ? "1px solid #c96442" : "1px solid #d9d7cf",
    background: primary ? "#d97757" : "#ffffff",
    color: primary ? "#ffffff" : "#2b2a26",
    cursor: "pointer",
  };
}
