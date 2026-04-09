"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/utils/cn";
import { MarkdownPreview } from "./MarkdownPreview";

type Citation = { url: string; title: string };

type SectionStatus = "searching" | "done" | "error";

export type ResearchSectionCardData = {
  title: string;
  status: SectionStatus;
  depth?: "shallow" | "deep";
  guidingQuestions?: string[];
  content?: string;
  citations?: Citation[];
};

function StatusBadge({ status }: { status: SectionStatus }) {
  const className =
    status === "done"
      ? "bg-green-50 border-green-200 text-green-700"
      : status === "error"
        ? "bg-red-50 border-red-200 text-red-700"
        : "bg-blue-50 border-blue-200 text-blue-700";

  return (
    <div
      className={cn(
        "text-xs px-2 py-0.5 rounded-full border",
        className
      )}
    >
      {status === "done" ? "Done" : status === "error" ? "Error" : "Researching"}
    </div>
  );
}

export function ResearchSectionCard({
  card,
}: {
  card: ResearchSectionCardData;
}) {
  const preview =
    card.content && card.content.length > 280
      ? card.content.slice(0, 280) + "…"
      : card.content ?? "";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="w-full text-left p-3 hover:bg-muted/50 transition-colors duration-150"
        >
          <div className="flex items-start gap-2 pr-5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate leading-snug">
                {card.title}
              </p>
              {card.depth && (
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                  {card.depth} research
                </p>
              )}
            </div>
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span className="truncate">{card.title}</span>
            {card.depth && (
              <span className="text-xs px-2 py-0.5 rounded-full border text-muted-foreground">
                {card.depth}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {card.status === "done"
              ? "Section draft with citations."
              : "Section is not complete yet."}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto pr-2 pt-1">
          {card.guidingQuestions && card.guidingQuestions.length > 0 && (
            <div className="space-y-2 mt-2">
              <div className="text-sm font-semibold">Guiding questions</div>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                {card.guidingQuestions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2 mt-4">
            <div className="text-sm font-semibold">Draft</div>
            <div className="border rounded-md p-3 bg-background text-sm leading-6">
              <MarkdownPreview content={card.content ?? "No content yet."} />
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <div className="text-sm font-semibold">Citations</div>
            {card.citations && card.citations.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {card.citations.map((c) => (
                  <li key={c.url} className="border rounded-md p-3 bg-background">
                    <div className="font-medium">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {c.title || c.url}
                      </a>
                    </div>
                    <div className="text-xs text-muted-foreground break-all">
                      {c.url}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted-foreground">
                No citations available yet.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

