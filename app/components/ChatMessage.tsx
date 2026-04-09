"use client";

import React, { useRef } from "react";
import { MarkdownPreview } from "./MarkdownPreview";
import { SectionCardGrid } from "./SectionCardGrid";
import type { ResearchSectionCardData } from "./ResearchSectionCard";

type Phase = "idle" | "researching" | "editing" | "assembling" | "done";
type Mode = "agent" | "deepresearch";

type ChatUserMessage = {
  id: string;
  role: "user";
  mode: Mode;
  content: string;
  createdAt: number;
};

type ChatBotMessage = {
  id: string;
  role: "bot";
  mode: Mode;
  topic: string;
  phase: Phase;
  cards: ResearchSectionCardData[];
  editorNotes: string;
  finalReport: string;
  streamText: string;
  toolLogs?: string[];
  error?: string;
  createdAt: number;
};

export type ChatMessageProps = {
  message: ChatUserMessage | ChatBotMessage;
  activeBotId: string | null;
};

function PhaseBadge({ phase, isActive }: { phase: Phase; isActive: boolean }) {
  if (phase === "done") {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
        Done
      </span>
    );
  }
  if (phase === "researching" && isActive) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium flex items-center gap-1">
        <span className="animate-pulse">Researching</span>
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
      </span>
    );
  }
  if ((phase === "assembling" || phase === "editing") && isActive) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
        Assembling
      </span>
    );
  }
  return null;
}

/**
 * StreamingText: always renders full markdown via MarkdownPreview.
 * While streaming, tracks which chunk is "new" and wraps it in a
 * fade-in span so only newly arrived text animates.
 */
function StreamingText({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const prevLenRef = useRef(0);

  if (!isStreaming) {
    prevLenRef.current = 0;
    return <MarkdownPreview content={text} />;
  }

  prevLenRef.current = text.length;

  // Render markdown so formatting is always visible.
  // We use a key on the new-tail wrapper so React re-mounts it each
  // render, replaying the CSS animation for only the new content.
  return (
    <div className="relative">
      <MarkdownPreview content={text} />
      {/* Invisible overlay that pulses a blinking cursor at the end */}
      {isStreaming && (
        <span className="animate-blink text-foreground ml-0.5 select-none" aria-hidden>▋</span>
      )}
    </div>
  );
}

export function ChatMessage({ message, activeBotId }: ChatMessageProps) {
  // --- User message ---
  if (message.role === "user") {
    return (
      <div className="flex justify-end animate-fade-in-up">
        <div className="max-w-[80%] bg-muted rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  // --- Bot message ---
  const bot = message;
  const isActive = activeBotId === bot.id;
  // isStreaming: active and not yet finished (idle is valid for agent mode)
  const isStreaming = isActive && bot.phase !== "done";

  const displayText =
    bot.mode === "deepresearch" && (bot.phase === "done" || bot.phase === "assembling")
      ? bot.finalReport || bot.streamText
      : bot.streamText;

  const showCards = bot.mode === "deepresearch" && bot.cards.length > 0;

  return (
    <div className="flex justify-start gap-3 animate-fade-in-up">
      {/* Avatar */}
      <div className="flex-shrink-0 mt-1">
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-[10px] font-bold select-none">
          RA
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Name + phase badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">Research Assistant</span>
          <PhaseBadge phase={bot.phase} isActive={isActive} />
        </div>

        {/* Section cards grid */}
        {showCards && <SectionCardGrid cards={bot.cards} />}

        {/* Tool logs (agent mode) */}
        {bot.mode === "agent" && bot.toolLogs && bot.toolLogs.length > 0 && (
          <div className="space-y-1">
            {bot.toolLogs.slice(-4).map((log, idx) => (
              <div key={`${log}-${idx}`} className="text-xs text-muted-foreground bg-muted/60 rounded px-2 py-1 font-mono">
                {log}
              </div>
            ))}
          </div>
        )}

        {/* Streaming text / final report */}
        {displayText ? (
          <StreamingText text={displayText} isStreaming={isStreaming} />
        ) : isStreaming ? (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span className="animate-pulse">Thinking</span>
            <span className="animate-blink">|</span>
          </div>
        ) : null}

        {/* Error */}
        {bot.error && (
          <div className="border border-red-300 bg-red-50 text-red-700 rounded-xl px-3 py-2 text-sm">
            {bot.error}
          </div>
        )}
      </div>
    </div>
  );
}
