"use client";

import { CheckCircle2 } from "lucide-react";
import { ResearchSectionCard, type ResearchSectionCardData } from "./ResearchSectionCard";

export function SectionCardGrid({ cards }: { cards: ResearchSectionCardData[] }) {
  const doneCount = cards.filter((c) => c.status === "done").length;
  const totalCount = cards.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
          {doneCount}/{totalCount}
        </span>
      </div>

      {/* 2-col card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-xl border border-border bg-white overflow-hidden transition-all duration-300"
          >
            {card.status === "searching" ? (
              /* Skeleton shimmer */
              <div className="p-3 space-y-2">
                <div className="animate-shimmer h-3 rounded-full w-3/4" />
                <div className="animate-shimmer h-2.5 rounded-full w-1/2" />
              </div>
            ) : (
              /* Done — clickable card using existing modal */
              <div className="relative">
                <ResearchSectionCard card={card} />
                <span className="absolute top-2 right-2 text-emerald-500 pointer-events-none">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
