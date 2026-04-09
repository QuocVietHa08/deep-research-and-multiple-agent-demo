"use client";

import dynamic from "next/dynamic";
import type { ArtifactVersion } from "@/lib/canvas/state";

// Both editors access `window` at load time — must be client-only
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  { ssr: false }
);

type ArtifactEditorProps = {
  artifact: ArtifactVersion;
  onSelectionChange: (text: string) => void;
  onChange?: (content: string) => void;
};

export function ArtifactEditor({
  artifact,
  onSelectionChange,
  onChange,
}: ArtifactEditorProps) {
  if (artifact.type === "markdown") {
    return (
      // data-color-mode="light" forces MDEditor into light mode to match the app theme
      <div
        className="flex-1 h-full overflow-auto"
        data-color-mode="light"
        onMouseUp={() => {
          const sel = window.getSelection()?.toString() ?? "";
          onSelectionChange(sel);
        }}
      >
        <MDEditor
          value={artifact.content}
          height="100%"
          preview="preview"
          hideToolbar
          onChange={(val) => onChange?.(val ?? "")}
        />
      </div>
    );
  }

  // Code artifact — Monaco Editor
  return (
    <div className="flex-1 h-full overflow-hidden">
      <MonacoEditor
        height="100%"
        language={artifact.language ?? "typescript"}
        value={artifact.content}
        theme="vs-light"
        onChange={(val) => onChange?.(val ?? "")}
        onMount={(editor) => {
          editor.onDidChangeCursorSelection(() => {
            const model = editor.getModel();
            const selection = editor.getSelection();
            if (!model || !selection) return;
            onSelectionChange(model.getValueInRange(selection));
          });
        }}
        options={{
          fontSize: 13,
          minimap: { enabled: false },
          wordWrap: "on",
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}
