"use client";

import { useEffect, useRef, useState } from "react";
import type { ResearchSectionCardData } from "./ResearchSectionCard";
import { ChatMessage } from "./ChatMessage";
import { InputBar } from "./InputBar";

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

type ChatMessage = ChatUserMessage | ChatBotMessage;

const STORAGE_KEY = "research_chat_v2";

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function DeepResearchChat() {
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<Mode>("agent");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState("");

  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const threadIdRef = useRef<string>(`thread-${Date.now()}`);

  // Track which bot message is the current streaming target.
  const activeBotIdRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ChatMessage[];
      if (!Array.isArray(parsed)) return;
      const normalized = parsed.map((m: any) => {
        if (m?.role === "bot") {
          return {
            ...m,
            mode: m.mode === "deepresearch" ? "deepresearch" : "agent",
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
          mode: m.mode === "deepresearch" ? "deepresearch" : "agent",
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
    // Keep the chat pinned to the latest content while streaming.
    if (!endRef.current) return;
    endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, running]);

  const clearChat = () => {
    setError("");
    setMessages([]);
    activeBotIdRef.current = null;
    threadIdRef.current = `thread-${Date.now()}`;
    setTopic("");
  };

  const handleModeChange = (nextMode: Mode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    // Keep behavior predictable across modes for demo.
    clearChat();
  };

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || running) return;

    setRunning(true);
    setError("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const userMsg: ChatUserMessage = {
        id: uid(),
        role: "user",
        mode,
        content: topic.trim(),
        createdAt: Date.now(),
      };

      const botId = uid();
      const botMsg: ChatBotMessage = {
        id: botId,
        role: "bot",
        mode,
        topic: topic.trim(),
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

      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: topic.trim(),
          mode,
          threadId: threadIdRef.current,
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
            const parsed = JSON.parse(raw) as {
              event: string;
              data: any;
            };

            const { event, data } = parsed;

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
                    phase: "researching",
                    streamText: "Preparing outline...\n\n",
                  };
                }),
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
                    (c) => c.title === subReport.section,
                  );
                  const nextData: ResearchSectionCardData = {
                    title: subReport.section,
                    status: "done",
                    content: subReport.content,
                    citations: subReport.citations,
                  };

                  const chunk =
                    `\n## ${subReport.section}\n\n${(subReport.content ?? "").trim()}\n`;
                  const nextStream = `${m.streamText ?? ""}${chunk}\n`;

                  if (idx === -1) {
                    return {
                      ...m,
                      cards: [...m.cards, nextData],
                      streamText: nextStream,
                    };
                  }

                  return {
                    ...m,
                    cards: m.cards.map((c, i) =>
                      i === idx
                        ? {
                            ...c,
                            ...nextData,
                          }
                        : c,
                    ),
                    streamText: nextStream,
                  };
                }),
              );
            }

            if (event === "token") {
              // Individual LLM token — append to streamText for live animation
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.role !== "bot" || m.id !== botId) return m;
                  return {
                    ...m,
                    streamText: (m.streamText ?? "") + String(data.text ?? ""),
                  };
                }),
              );
            }

            if (event === "thinking") {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.role !== "bot" || m.id !== botId) return m;
                  return {
                    ...m,
                    phase: m.mode === "agent" ? "idle" : m.phase,
                    streamText: String(data.text ?? ""),
                  };
                }),
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
                }),
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
                }),
              );
            }

            if (event === "answer") {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.role !== "bot" || m.id !== botId) return m;
                  const text = String(data.text ?? "");
                  return {
                    ...m,
                    phase: "assembling",
                    finalReport: text,
                    streamText: text,
                  };
                }),
              );
            }

            if (event === "done") {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.role !== "bot" || m.id !== botId) return m;
                  return {
                    ...m,
                    phase: "done",
                  };
                }),
              );
            }

            if (event === "error") {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.role !== "bot" || m.id !== botId) return m;
                  return {
                    ...m,
                    phase: "idle",
                    error: String(data ?? "Unknown error"),
                  };
                }),
              );
              setError(String(data ?? "Unknown error"));
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
              phase: "idle",
              error: err instanceof Error ? err.message : String(err),
            };
          }),
        );
      }
    } finally {
      setRunning(false);
    }
  };

  const stop = () => {
    if (!running) return;
    abortRef.current?.abort();
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Scrollable message area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

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
                    : "Ask anything and our AI agent will think and answer."}
                </p>
              </div>
              {/* Example prompt chips */}
              <div className="flex flex-wrap justify-center gap-2">
                {(mode === "deepresearch"
                  ? ["The future of nuclear fusion energy", "History of the Roman Empire's decline", "Current state of quantum computing"]
                  : ["Explain how transformers work", "What is the CAP theorem?", "Compare REST vs GraphQL"]
                ).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setTopic(prompt)}
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
                <ChatMessage key={m.id} message={m as any} activeBotId={activeBotIdRef.current} />
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
          onTopicChange={setTopic}
          onModeChange={handleModeChange}
          onSubmit={start}
          onStop={stop}
          onClear={clearChat}
        />
      </div>
    </div>
  );
}
