"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Phase =
  | "idle"
  | "researching"
  | "editing"
  | "assembling"
  | "done";

type SectionStatus = "searching" | "done" | "error";

type SectionCard = {
  title: string;
  status: SectionStatus;
  depth?: "shallow" | "deep";
  content?: string;
};

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

export function DeepResearch() {
  const [topic, setTopic] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");

  const [cards, setCards] = useState<SectionCard[]>([]);
  const [editorNotes, setEditorNotes] = useState("");
  const [finalReport, setFinalReport] = useState("");

  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const doneCount = useMemo(
    () => cards.filter((c) => c.status === "done").length,
    [cards]
  );

  const totalCount = cards.length;

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || running) return;

    setRunning(true);
    setError("");
    setPhase("researching");
    setCards([]);
    setEditorNotes("");
    setFinalReport("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/deepresearch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

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

            if (event === "outlinePlanner") {
              const outline = data.outline as OutlineSection[];
              setCards(
                outline.map((s) => ({
                  title: s.title,
                  status: "searching",
                  depth: s.depth,
                }))
              );
            }

            if (event === "topicAgent") {
              const subReport = data.subReport as SubReport;
              setCards((prev) => {
                const idx = prev.findIndex((c) => c.title === subReport.section);
                if (idx === -1) {
                  return [
                    ...prev,
                    {
                      title: subReport.section,
                      status: "done",
                      content: subReport.content,
                    },
                  ];
                }

                return prev.map((c) =>
                  c.title === subReport.section
                    ? { ...c, status: "done", content: subReport.content }
                    : c
                );
              });
            }

            if (event === "editor") {
              setPhase("editing");
              setEditorNotes(String(data.editorNotes ?? ""));
            }

            if (event === "assembler") {
              setPhase("assembling");
              setFinalReport(String(data.finalReport ?? ""));
            }

            if (event === "done") {
              setPhase("done");
            }

            if (event === "error") {
              setError(String(data ?? "Unknown error"));
              setPhase("idle");
            }
          } catch {
            // Ignore individual JSON parse failures.
          }
        }
      }
    } catch (err) {
      if ((err as any)?.name !== "AbortError") {
        setError(err instanceof Error ? err.message : String(err));
      }
      setPhase("idle");
    } finally {
      setRunning(false);
    }
  };

  const stepLabel = (() => {
    if (phase === "idle") return "Idle";
    if (phase === "researching") return "Researching";
    if (phase === "editing") return "Editing";
    if (phase === "assembling") return "Assembling";
    return "Done";
  })();

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">DeepResearch</h1>
        <p className="text-sm text-muted-foreground">
          Multi-agent long-form research with parallel section drafts and
          citation consolidation.
        </p>
      </div>

      <form onSubmit={start} className="space-y-3">
        <Textarea
          placeholder="Ask a broad research topic…"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={running}
          rows={3}
          className="resize-none"
        />
        <Button
          type="submit"
          disabled={running || !topic.trim()}
          className="w-full"
        >
          {running ? "Researching…" : "Start Research"}
        </Button>
      </form>

      {phase !== "idle" && (
        <div className="border rounded-md px-4 py-3 bg-muted/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">
              Step: <span className="font-semibold">{stepLabel}</span>
            </div>

            {phase === "researching" && totalCount > 0 && (
              <div className="text-sm text-muted-foreground">
                {doneCount}/{totalCount} sections ready
              </div>
            )}
          </div>

          {phase === "editing" && (
            <div className="text-sm text-muted-foreground mt-2">
              Reviewing sections for duplication, coverage, and citation
              consistency…
            </div>
          )}

          {phase === "assembling" && (
            <div className="text-sm text-muted-foreground mt-2">
              Consolidating sections into a single report…
            </div>
          )}
        </div>
      )}

      {cards.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Research Sections
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cards.map((card) => (
              <div
                key={card.title}
                className="border rounded-md p-3 bg-background"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{card.title}</div>
                    {card.depth && (
                      <div className="text-xs text-muted-foreground">
                        Depth: {card.depth}
                      </div>
                    )}
                  </div>

                  <div
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      card.status === "done"
                        ? "bg-green-50 border-green-200 text-green-700"
                        : card.status === "error"
                          ? "bg-red-50 border-red-200 text-red-700"
                          : "bg-blue-50 border-blue-200 text-blue-700"
                    }`}
                  >
                    {card.status === "done"
                      ? "Done"
                      : card.status === "error"
                        ? "Error"
                        : "Researching"}
                  </div>
                </div>

                {card.status !== "done" ? (
                  <div className="mt-3 text-sm text-muted-foreground">
                    <span className="animate-spin inline-block mr-2">
                      ⏳
                    </span>
                    Gathering sources…
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">
                    {card.content ? card.content.slice(0, 500) : ""}
                    {card.content && card.content.length > 500 ? "…" : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {editorNotes && phase !== "idle" && (
        <div className="border rounded-md p-4 bg-muted/30">
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Editing Notes
          </div>
          <div className="mt-2 whitespace-pre-wrap text-sm">
            {editorNotes}
          </div>
        </div>
      )}

      {finalReport && phase !== "idle" && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Final Report
          </div>
          <div className="border rounded-md px-4 py-3 bg-background whitespace-pre-wrap text-sm leading-6">
            {finalReport}
          </div>
        </div>
      )}

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-700 rounded-md px-4 py-3 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

