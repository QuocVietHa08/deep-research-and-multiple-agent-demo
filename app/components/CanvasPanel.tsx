"use client";

import { useEffect, useRef, useState } from "react";
import type { ArtifactVersion } from "@/lib/canvas/state";
import { ArtifactEditor } from "./ArtifactEditor";
import { ArtifactToolbar } from "./ArtifactToolbar";

type CanvasPanelProps = {
  artifact: ArtifactVersion | null;
  versions: ArtifactVersion[];
  onVersionSelect: (v: ArtifactVersion) => void;
  onQuickAction: (prompt: string, selectedText: string) => void;
  onClose?: () => void;
  isLoading?: boolean;
  /** Live content streamed token-by-token before the artifact is finalised */
  streamingContent?: string | null;
};

// ── Streaming content view ────────────────────────────────────────────────────
// Renders the progressively received text with a blinking cursor at the end.
function StreamingView({ content }: { content: string }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as content grows
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [content]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 font-mono text-sm leading-7 text-foreground whitespace-pre-wrap break-words selection:bg-indigo-100">
      {content}
      {/* Blinking cursor */}
      <span
        className="inline-block w-[2px] h-[1em] bg-indigo-500 ml-0.5 align-text-bottom"
        style={{ animation: "caretBlink 1s step-end infinite" }}
      />
      <div ref={bottomRef} />
      <style>{`
        @keyframes caretBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Empty / loading state ────────────────────────────────────────────────────
function EmptyState({ isLoading }: { isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="flex gap-1.5 items-center">
          <span className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce" />
        </div>
        <p className="text-sm text-muted-foreground">Generating artifact…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4 px-8">
      {/* Icon */}
      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center shadow-inner">
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7 text-indigo-500"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
          />
        </svg>
      </div>

      <div>
        <h3 className="text-base font-semibold text-foreground">Canvas is empty</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-xs leading-relaxed">
          Start a conversation on the left — ask the AI to write, draft, or create any
          document or code artifact.
        </p>
      </div>

      {/* Example prompts */}
      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {[
          "Write a blog post about AI",
          "Draft a README for a React app",
          "Write a Python script to parse CSV",
        ].map((ex) => (
          <span
            key={ex}
            className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted text-muted-foreground"
          >
            {ex}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function CanvasPanel({
  artifact,
  versions,
  onVersionSelect,
  onQuickAction,
  onClose,
  isLoading = false,
  streamingContent = null,
}: CanvasPanelProps) {
  const [selectedText, setSelectedText] = useState("");

  // Derive display state:
  // - isStreaming: live token-by-token content is arriving
  // - isUpdating: artifact exists + new streaming content is incoming (update flow)
  const isStreaming = streamingContent !== null;
  const isUpdating = isStreaming && artifact !== null;

  // ── No artifact yet ──────────────────────────────────────────────────────
  if (!artifact) {
    // Streaming a brand-new artifact — show the live view
    if (isStreaming) {
      return (
        <div className="flex flex-col h-full bg-white overflow-hidden">
          {/* Title bar — streaming state */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-white/80 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 shrink-0">
                ✦ Canvas
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center gap-1.5 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Writing…
              </span>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                title="Close canvas"
                className="ml-2 h-6 w-6 shrink-0 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Close canvas panel"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current">
                  <path d="M4.293 4.293a1 1 0 0 1 1.414 0L8 6.586l2.293-2.293a1 1 0 1 1 1.414 1.414L9.414 8l2.293 2.293a1 1 0 0 1-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 0 1-1.414-1.414L6.586 8 4.293 5.707a1 1 0 0 1 0-1.414Z" />
                </svg>
              </button>
            )}
          </div>

          {/* Live streaming view */}
          <StreamingView content={streamingContent} />
        </div>
      );
    }

    // No artifact, no streaming — show empty / loading state
    return <EmptyState isLoading={isLoading} />;
  }

  // ── Artifact exists ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-white/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 shrink-0">
            ✦ Canvas
          </span>
          <span className="text-sm font-semibold text-foreground truncate">
            {artifact.title || "Untitled"}
          </span>
          {isUpdating && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center gap-1 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Rewriting…
            </span>
          )}
          {isLoading && !isUpdating && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center gap-1 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Updating
            </span>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Close canvas"
            className="ml-2 h-6 w-6 shrink-0 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close canvas panel"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current">
              <path d="M4.293 4.293a1 1 0 0 1 1.414 0L8 6.586l2.293-2.293a1 1 0 1 1 1.414 1.414L9.414 8l2.293 2.293a1 1 0 0 1-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 0 1-1.414-1.414L6.586 8 4.293 5.707a1 1 0 0 1 0-1.414Z" />
            </svg>
          </button>
        )}
      </div>

      {/* Quick-action + version toolbar */}
      <ArtifactToolbar
        artifact={artifact}
        versions={versions}
        selectedText={selectedText}
        onVersionSelect={onVersionSelect}
        onQuickAction={onQuickAction}
      />

      {/* Editor area */}
      <div className="flex-1 overflow-hidden relative">
        {/* Streaming overlay — shows incoming update content on top of the old artifact */}
        {isUpdating && (
          <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-[2px] flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-indigo-100 bg-indigo-50/80 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-xs font-medium text-indigo-700">Streaming update…</span>
            </div>
            <StreamingView content={streamingContent!} />
          </div>
        )}

        <ArtifactEditor artifact={artifact} onSelectionChange={setSelectedText} />
      </div>
    </div>
  );
}
