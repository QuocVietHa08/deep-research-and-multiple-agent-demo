"use client";

import { cn } from "@/utils/cn";

type Mode = "agent" | "deepresearch";

type InputBarProps = {
  topic: string;
  mode: Mode;
  running: boolean;
  onTopicChange: (v: string) => void;
  onModeChange: (m: Mode) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop: () => void;
  onClear: () => void;
};

export function InputBar({
  topic,
  mode,
  running,
  onTopicChange,
  onModeChange,
  onSubmit,
  onStop,
  onClear,
}: InputBarProps) {
  return (
    <form onSubmit={onSubmit} className="w-full max-w-3xl mx-auto">
      <div
        className={cn(
          "rounded-2xl border border-input bg-white shadow-md shadow-black/5",
          "flex flex-col focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
          "transition-shadow duration-200",
        )}
      >
        {/* TOP: mode toggles + clear */}

        {/* MIDDLE: auto-grow textarea */}
        <textarea
          placeholder={
            mode === "deepresearch"
              ? "Enter a research topic..."
              : "Ask anything..."
          }
          value={topic}
          onChange={(e) => {
            onTopicChange(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!running && topic.trim()) onSubmit(e as any);
            }
          }}
          disabled={running}
          rows={2}
          className="w-full resize-none bg-transparent px-4 py-3 text-sm leading-6 placeholder:text-muted-foreground focus:outline-none min-h-[56px] max-h-[240px] overflow-y-auto"
        />

        {/* BOTTOM: send/stop button */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          <div className="flex items-center gap-2">
            {(["agent", "deepresearch"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange(m)}
                className={cn(
                  "text-xs px-3 py-1 rounded-full border font-medium transition-colors duration-150",
                  mode === m
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
                )}
              >
                {m === "agent" ? "Agent" : "Deep Research"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-3 pt-3">
              <button
                type="button"
                onClick={onClear}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            </div>

             {running ? (
            <button
              type="button"
              onClick={onStop}
              className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
              aria-label="Stop"
            >
              <svg viewBox="0 0 16 16" className="h-3 w-3 fill-current">
                <rect x="3" y="3" width="10" height="10" rx="1" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!topic.trim()}
              className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors"
              aria-label="Send"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current">
                <path d="M8 2l6 6H9v6H7V8H2z" />
              </svg>
            </button>
          )}
          </div>
         
        </div>
      </div>
    </form>
  );
}
