import { NextRequest } from "next/server";
import "@/lib/deepresearch/langsmith";
import { deepResearchGraph } from "@/lib/deepresearch/orchestrator";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { topic } = await req.json();

  if (!topic || typeof topic !== "string") {
    return new Response(JSON.stringify({ error: "topic is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              event,
              data,
            })}\n\n`
          )
        );
      };

      try {
        const eventStream = await deepResearchGraph.stream(
          { topic },
          { streamMode: "updates" }
        );

        for await (const update of eventStream) {
          for (const [, statePartial] of Object.entries(update)) {
            const partial = statePartial as any;

            if (partial?.outline) {
              send("outlinePlanner", { outline: partial.outline });
            }

            if (Array.isArray(partial?.subReports) && partial.subReports.length) {
              for (const subReport of partial.subReports) {
                send("topicAgent", {
                  section: subReport.section,
                  subReport,
                });
              }
            }

            if (typeof partial?.editorNotes === "string") {
              send("editor", { editorNotes: partial.editorNotes });
            }

            if (typeof partial?.finalReport === "string") {
              send("assembler", { finalReport: partial.finalReport });
            }
          }
        }

        send("done", null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send("error", message);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

