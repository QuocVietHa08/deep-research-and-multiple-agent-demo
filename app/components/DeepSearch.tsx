"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Step = { node: string; summary: string };

type SearchResult = { query: string; content: string; url?: string };

export function DeepSearch() {
  const [question, setQuestion] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [answer, setAnswer] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [iteration, setIteration] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || running) return;

    setSteps([]);
    setAnswer("");
    setError("");
    setIteration(0);
    setRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/deepsearch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const { event, data } = JSON.parse(raw);
            console.log("[DeepSearch] event:", event, data);

            if (event === "planner") {
              const queries: string[] = data.queries ?? [];
              setSteps((prev) => [
                ...prev,
                {
                  node: "planner",
                  summary: `Planned ${queries.length} queries: ${queries.join(", ")}`,
                },
              ]);
            } else if (event === "search") {
              const results: SearchResult[] = data.results ?? [];
              setSteps((prev) => [
                ...prev,
                {
                  node: "search",
                  summary: `Found ${results.length} results`,
                },
              ]);
            } else if (event === "reflect") {
              const iter: number = data.iterations ?? 0;
              setIteration(iter);
              setSteps((prev) => [
                ...prev,
                {
                  node: "reflect",
                  summary: data.reflection || `Reflection complete (iteration ${iter})`,
                },
              ]);
            } else if (event === "synthesize") {
              setAnswer(data.answer ?? "");
              setSteps((prev) => [
                ...prev,
                { node: "synthesize", summary: "Answer synthesized" },
              ]);
            } else if (event === "error") {
              setError(data as string);
            }
          } catch {
            // ignore parse errors on individual lines
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setRunning(false);
    }
  };

  const nodeIcon: Record<string, string> = {
    planner: "🗂",
    search: "🔍",
    reflect: "🪞",
    synthesize: "✍️",
  };

  const nodeLabel: Record<string, string> = {
    planner: "Planner",
    search: "Searcher",
    reflect: "Reflector",
    synthesize: "Synthesizer",
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">DeepSearch</h1>
        <p className="text-sm text-muted-foreground">
          Iterative AI research — searches the web, reflects on gaps, and synthesizes a cited answer.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          placeholder="Ask a research question…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={running}
          rows={3}
          className="resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
        />
        <Button type="submit" disabled={running || !question.trim()} className="w-full">
          {running ? "Researching…" : "Deep Search"}
        </Button>
      </form>

      {/* Progress steps */}
      {steps.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Research Progress
            {iteration > 1 && (
              <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                Iteration {iteration}
              </span>
            )}
          </h2>
          <ul className="space-y-2">
            {steps.map((step, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm border rounded-md px-3 py-2 bg-muted/40"
              >
                <span className="text-base leading-5">{nodeIcon[step.node] ?? "•"}</span>
                <div>
                  <span className="font-medium">{nodeLabel[step.node] ?? step.node}</span>
                  <span className="text-muted-foreground"> — {step.summary}</span>
                </div>
              </li>
            ))}
            {running && (
              <li className="flex items-center gap-2 text-sm text-muted-foreground px-3 py-2">
                <span className="animate-spin">⏳</span> Working…
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border border-red-300 bg-red-50 text-red-700 rounded-md px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Final answer */}
      {answer && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Answer
          </h2>
          <div className="prose prose-sm max-w-none border rounded-md px-4 py-3 bg-background whitespace-pre-wrap">
            {answer}
          </div>
        </div>
      )}
    </div>
  );
}
