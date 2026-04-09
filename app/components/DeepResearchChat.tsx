"use client";

import { useEffect, useRef, useState } from "react";
import type { ResearchSectionCardData } from "./ResearchSectionCard";
import { ChatMessage } from "./ChatMessage";
import { InputBar } from "./InputBar";
import { CanvasLayout } from "./CanvasLayout";
import { CanvasPanel } from "./CanvasPanel";
import type { ArtifactVersion } from "@/lib/canvas/state";

type Phase = "idle" | "researching" | "editing" | "assembling" | "done";
type Mode = "agent" | "deepresearch";

type OutlineSection = {
  title: string;
  guidingQuestions: string[];
  depth: "shallow" | "deep";
};

type SubReport = {
  section: string;
  content: string;
  citations: { url: string; title: string }[];
};

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

type ChatMsg = ChatUserMessage | ChatBotMessage;

const STORAGE_KEY = "research_chat_v2";

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Chat panel (shared across all modes) ─────────────────────────────────────

function ChatPanel({
  messages,
  error,
  running,
  mode,
  topic,
  activeBotId,
  endRef,
  showCanvas,
  onTopicChange,
  onModeChange,
  onSubmit,
  onStop,
  onClear,
}: {
  messages: ChatMsg[];
  error: string;
  running: boolean;
  mode: Mode;
  topic: string;
  activeBotId: string | null;
  endRef: React.RefObject<HTMLDivElement>;
  showCanvas: boolean;
  onTopicChange: (v: string) => void;
  onModeChange: (m: Mode) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop: () => void;
  onClear: () => void;
}) {
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Scrollable message area */}
      <div className="flex-1 overflow-y-auto">
        <div className={`max-w-3xl mx-auto px-4 py-6 space-y-6 ${showCanvas ? "max-w-xl" : ""}`}>
          {messages.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6 animate-fade-in-up">
              <div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">
                  What would you like to research?
                </h2>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  {mode === "deepresearch"
                    ? "Enter a broad topic and we'll stream a structured report with sources."
                    : "Ask anything. When the answer is long, it will appear in the Canvas panel →"}
                </p>
              </div>
              {/* Example prompt chips */}
              <div className="flex flex-wrap justify-center gap-2">
                {(mode === "deepresearch"
                  ? [
                      "The future of nuclear fusion energy",
                      "History of the Roman Empire's decline",
                      "Current state of quantum computing",
                    ]
                  : [
                      "Write a blog post about AI trends in 2025",
                      "Draft a README for a React component library",
                      "Explain how transformers work",
                      "Compare REST vs GraphQL",
                    ]
                ).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => onTopicChange(prompt)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border bg-white text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-150"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((m) => (
                <ChatMessage key={m.id} message={m as any} activeBotId={activeBotId} />
              ))}
            </div>
          )}

          {error && (
            <div className="border border-red-300 bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* Sticky input bar */}
      <div className="flex-shrink-0 px-4 py-4 bg-white">
        <InputBar
          topic={topic}
          mode={mode}
          running={running}
          onTopicChange={onTopicChange}
          onModeChange={onModeChange}
          onSubmit={onSubmit}
          onStop={onStop}
          onClear={onClear}
        />
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function DeepResearchChat() {
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<Mode>("agent");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [error, setError] = useState("");

  // Canvas-specific state
  const [artifact, setArtifact] = useState<ArtifactVersion | null>(null);
  const [artifactVersions, setArtifactVersions] = useState<ArtifactVersion[]>([]);
  const [canvasLoading, setCanvasLoading] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);
  // Live content streamed from the agent before artifact is finalised
  const [streamingContent, setStreamingContent] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const threadIdRef = useRef<string>(`thread-${Date.now()}`);

  // Track which bot message is the current streaming target.
  const activeBotIdRef = useRef<string | null>(null);

  // ── Persist messages to localStorage ──────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ChatMsg[];
      if (!Array.isArray(parsed)) return;
      const normalized = parsed.map((m: any) => {
        if (m?.role === "bot") {
          return {
            ...m,
            mode: (["agent", "deepresearch"].includes(m.mode)
              ? m.mode
              : "agent") as Mode,
            streamText:
              typeof m.streamText === "string"
                ? m.streamText
                : typeof m.finalReport === "string"
                ? m.finalReport
                : "",
          };
        }
        return {
          ...m,
          mode: (["agent", "deepresearch"].includes(m.mode)
            ? m.mode
            : "agent") as Mode,
        };
      });
      setMessages(normalized);
    } catch {
      // Ignore storage errors.
    }
  }, []);

  useEffect(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch {
        // Ignore storage quota errors.
      }
    }, 250);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [messages]);

  useEffect(() => {
    if (!endRef.current) return;
    endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, running]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const clearChat = () => {
    setError("");
    setMessages([]);
    activeBotIdRef.current = null;
    threadIdRef.current = `thread-${Date.now()}`;
    setTopic("");
    // Reset canvas state too
    setArtifact(null);
    setArtifactVersions([]);
    setCanvasLoading(false);
    setShowCanvas(false);
    setStreamingContent(null);
  };

  const handleModeChange = (nextMode: Mode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    clearChat();
  };

  // ── Canvas close ────────────────────────────────────────────────────────────
  const handleCloseCanvas = () => {
    setShowCanvas(false);
  };

  // ── Quick action (canvas toolbar shortcuts) ─────────────────────────────────
  // Quick actions are always sent to the agent with context about the current
  // artifact. The agent will call canvas_update with the revised content.
  const handleQuickAction = (prompt: string, selectedText: string) => {
    if (running) return;
    const artifactContext = artifact
      ? `\n\n[Current canvas artifact: "${artifact.title}". Type: ${artifact.type}. ${selectedText ? `Selected text: "${selectedText.slice(0, 200)}"` : "Apply to the full document."}]`
      : "";
    const fullPrompt = `${prompt}${artifactContext}`;
    setTopic(fullPrompt);
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    submitMessage(fakeEvent, fullPrompt, selectedText || null);
  };

  // ── Version navigation ─────────────────────────────────────────────────────
  const handleVersionSelect = (v: ArtifactVersion) => {
    setArtifact(v);
  };

  // ── Main submit ────────────────────────────────────────────────────────────
  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || running) return;
    await submitMessage(e, topic.trim(), null);
  };

  const submitMessage = async (
    e: React.FormEvent,
    message: string,
    selectedText: string | null
  ) => {
    if (!message.trim() || running) return;

    setRunning(true);
    setError("");
    // Always use agent mode — canvas is just a side panel opened by tools
    if (canvasLoading) setCanvasLoading(false);
    if (artifact) setCanvasLoading(true);  // optimistically show updating state

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const userMsg: ChatUserMessage = {
        id: uid(),
        role: "user",
        mode,
        content: message,
        createdAt: Date.now(),
      };

      const botId = uid();
      const botMsg: ChatBotMessage = {
        id: botId,
        role: "bot",
        mode,
        topic: message,
        phase: mode === "deepresearch" ? "researching" : "idle",
        cards: [],
        editorNotes: "",
        finalReport: "",
        streamText: "",
        toolLogs: [],
        createdAt: Date.now(),
      };

      activeBotIdRef.current = botId;
      setMessages((prev) => [...prev, userMsg, botMsg]);
      setTopic(""); // clear input immediately after send

      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          // Always route to agent; canvas tools are invoked by the agent
          mode: mode === "deepresearch" ? "deepresearch" : "agent",
          threadId: threadIdRef.current,
          selectedText: selectedText ?? undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          if (!chunk.startsWith("data: ")) continue;
          const raw = chunk.slice(6).trim();
          if (!raw) continue;

          try {
            const parsed = JSON.parse(raw) as { event: string; data: any };
            const { event, data } = parsed;

            // ── Canvas SSE events ──────────────────────────────────────────
            if (event === "canvas_open") {
              setShowCanvas(true);
              setStreamingContent(""); // start fresh streaming
            }

            if (event === "artifact_chunk") {
              // Progressive content token arriving from the canvas tool call
              const delta = String(data.delta ?? "");
              setStreamingContent((prev) => (prev ?? "") + delta);
            }

            if (event === "routing") {
              // e.g. { action: "generate" | "update" | "reply" }
              // Optionally show routing in the bot message
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.role !== "bot" || m.id !== botId) return m;
                  return {
                    ...m,
                    streamText:
                      data.action === "reply"
                        ? ""
                        : `Preparing to ${data.action} artifact…`,
                  };
                })
              );
            }

            if (event === "artifact") {
              // data is an ArtifactVersion
              const newVersion = data as ArtifactVersion;
              setStreamingContent(null); // streaming done — real artifact takes over
              setArtifact(newVersion);
              setArtifactVersions((prev) => {
                // Avoid duplicates
                if (prev.find((v) => v.id === newVersion.id)) return prev;
                return [...prev, newVersion];
              });
              setCanvasLoading(false);
              // Mark bot message as done (artifact delivered)
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.role !== "bot" || m.id !== botId) return m;
                  return {
                    ...m,
                    phase: "done" as Phase,
                    streamText: `✦ Artifact updated: **${newVersion.title}**`,
                    finalReport: `✦ Artifact updated: **${newVersion.title}**`,
                  };
                })
              );
            }

            if (event === "chat") {
              // Canvas conversational reply (no artifact change)
              const text = String(data.text ?? "");
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.role !== "bot" || m.id !== botId) return m;
                  return {
                    ...m,
                    phase: "done" as Phase,
                    streamText: text,
                    finalReport: text,
                  };
                })
              );
              setCanvasLoading(false);
            }

            // ── DeepResearch SSE events ────────────────────────────────────
            if (event === "outline") {
              const outline = (data.sections ?? []) as OutlineSection[];
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.role !== "bot" || m.id !== botId) return m;
                  return {
                    ...m,
                    cards: outline.map((s) => ({
                      title: s.title,
                      status: "searching",
                      depth: s.depth,
                      guidingQuestions: s.guidingQuestions,
                    })),
                    phase: "researching" as Phase,
                    streamText: "Preparing outline…\n\n",
                  };
                })
              );
            }

            if (event === "section") {
              const subReport = {
                section: String(data.title ?? ""),
                content: String(data.content ?? ""),
                citations: Array.isArray(data.citations) ? data.citations : [],
              } as SubReport;
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.role !== "bot" || m.id !== botId) return m;
                  const idx = m.cards.findIndex(
                    (c) => c.title === subReport.section
                  );
                  const nextData: ResearchSectionCardData = {
                    title: subReport.section,
                    status: "done",
                    content: subReport.content,
                    citations: subReport.citations,
                  };

                  const chunk = `\n## ${subReport.section}\n\n${(subReport.content ?? "").trim()}\n`;
                  const nextStream = `${m.streamText ?? ""}${chunk}\n`;

                  if (idx === -1) {
                    return { ...m, cards: [...m.cards, nextData], streamText: nextStream };
                  }
                  return {
                    ...m,
                    cards: m.cards.map((c, i) => (i === idx ? { ...c, ...nextData } : c)),
                    streamText: nextStream,
                  };
                })
              );
            }

            // ── Agent SSE events ───────────────────────────────────────────
            if (event === "token") {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.role !== "bot" || m.id !== botId) return m;
                  return {
                    ...m,
                    streamText: (m.streamText ?? "") + String(data.text ?? ""),
                  };
                })
              );
            }

            if (event === "thinking") {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.role !== "bot" || m.id !== botId) return m;
                  return {
                    ...m,
                    phase: m.mode === "agent" ? ("idle" as Phase) : m.phase,
                    streamText: String(data.text ?? ""),
                  };
                })
              );
            }

            if (event === "tool") {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.role !== "bot" || m.id !== botId) return m;
                  return {
                    ...m,
                    toolLogs: [
                      ...(m.toolLogs ?? []),
                      `Tool: ${String(data.name ?? "tool")} called`,
                    ],
                  };
                })
              );
            }

            if (event === "observation") {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.role !== "bot" || m.id !== botId) return m;
                  return {
                    ...m,
                    toolLogs: [
                      ...(m.toolLogs ?? []),
                      `Observation from ${String(data.name ?? "tool")}`,
                    ],
                  };
                })
              );
            }

            if (event === "answer") {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.role !== "bot" || m.id !== botId) return m;
                  const text = String(data.text ?? "");
                  return {
                    ...m,
                    phase: "assembling" as Phase,
                    finalReport: text,
                    streamText: text,
                  };
                })
              );
            }

            if (event === "done") {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.role !== "bot" || m.id !== botId) return m;
                  return { ...m, phase: "done" as Phase };
                })
              );
              setCanvasLoading(false);
            }

            if (event === "error") {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.role !== "bot" || m.id !== botId) return m;
                  return {
                    ...m,
                    phase: "idle" as Phase,
                    error: String(data ?? "Unknown error"),
                  };
                })
              );
              setError(String(data ?? "Unknown error"));
              setCanvasLoading(false);
            }
          } catch {
            // Ignore individual JSON parse failures.
          }
        }
      }
    } catch (err) {
      if ((err as any)?.name !== "AbortError") {
        setError(err instanceof Error ? err.message : String(err));
      } else {
        setError("Cancelled");
      }

      const botId = activeBotIdRef.current;
      if (botId) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.role !== "bot" || m.id !== botId) return m;
            return {
              ...m,
              phase: "idle" as Phase,
              error: err instanceof Error ? err.message : String(err),
            };
          })
        );
      }
      setCanvasLoading(false);
    } finally {
      setRunning(false);
      setTopic("");
    }
  };

  const stop = () => {
    if (!running) return;
    abortRef.current?.abort();
    setCanvasLoading(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const chatPanel = (
    <ChatPanel
      messages={messages}
      error={error}
      running={running}
      mode={mode}
      topic={topic}
      activeBotId={activeBotIdRef.current}
      endRef={endRef}
      showCanvas={showCanvas}
      onTopicChange={setTopic}
      onModeChange={handleModeChange}
      onSubmit={start}
      onStop={stop}
      onClear={clearChat}
    />
  );

  if (showCanvas) {
    return (
      <CanvasLayout
        chat={chatPanel}
        canvas={
          <CanvasPanel
            artifact={artifact}
            versions={artifactVersions}
            onVersionSelect={handleVersionSelect}
            onQuickAction={handleQuickAction}
            onClose={handleCloseCanvas}
            isLoading={canvasLoading}
            streamingContent={streamingContent}
          />
        }
      />
    );
  }

  return chatPanel;
}
