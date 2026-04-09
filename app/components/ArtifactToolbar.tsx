"use client";

import type { ArtifactVersion } from "@/lib/canvas/state";

const QUICK_ACTIONS: { label: string; prompt: string }[] = [
  { label: "Fix grammar",        prompt: "Fix all grammar and spelling errors" },
  { label: "Make concise",       prompt: "Make this more concise, remove filler" },
  { label: "Add comments",       prompt: "Add clear inline comments to the code" },
  { label: "Translate EN→VI",    prompt: "Translate this to Vietnamese" },
  { label: "Add error handling", prompt: "Add proper error handling and edge cases" },
];

type ArtifactToolbarProps = {
  artifact: ArtifactVersion;
  versions: ArtifactVersion[];
  selectedText: string;
  onVersionSelect: (v: ArtifactVersion) => void;
  onQuickAction: (prompt: string, selectedText: string) => void;
};

export function ArtifactToolbar({
  artifact,
  versions,
  selectedText,
  onVersionSelect,
  onQuickAction,
}: ArtifactToolbarProps) {
  const versionIndex = versions.findIndex((v) => v.id === artifact.id);
  const hasPrev = versionIndex > 0;
  const hasNext = versionIndex < versions.length - 1;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border-tertiary,#e5e7eb)] bg-white shrink-0 flex-wrap"
      style={{ minHeight: 40 }}
    >
      {/* Version navigation */}
      <button
        type="button"
        disabled={!hasPrev}
        onClick={() => onVersionSelect(versions[versionIndex - 1])}
        className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ← Prev
      </button>

      <span className="text-xs text-gray-400 font-mono">
        v{versionIndex + 1} / {versions.length}
      </span>

      <button
        type="button"
        disabled={!hasNext}
        onClick={() => onVersionSelect(versions[versionIndex + 1])}
        className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next →
      </button>

      <div className="flex-1" />

      {/* Quick action buttons */}
      {QUICK_ACTIONS.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={() => onQuickAction(a.prompt, selectedText)}
          title={
            selectedText
              ? `Apply to selection: "${selectedText.slice(0, 30)}..."`
              : "Apply to full document"
          }
          className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
        >
          {a.label}
        </button>
      ))}

      {/* Type badge */}
      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200 shrink-0">
        {artifact.type === "code"
          ? `${artifact.language ?? "code"}`
          : "markdown"}
      </span>
    </div>
  );
}
