import { NextRequest } from "next/server";
import { deepsearchGraph } from "@/lib/deepsearch/graph";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { question } = await req.json();

  if (!question || typeof question !== "string") {
    return new Response(JSON.stringify({ error: "question is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        const line = `data: ${JSON.stringify({ event, data })}\n\n`;
        console.log("[api] Sending event:", event);
        controller.enqueue(encoder.encode(line));
      };

      try {
        const eventStream = await deepsearchGraph.stream(
          { question },
          { streamMode: "updates" }
        );

        for await (const update of eventStream) {
          // update is { nodeName: statePartial }
          for (const [nodeName, statePartial] of Object.entries(update)) {
            if (nodeName === "planner") {
              send("planner", {
                queries: (statePartial as { queries?: string[] }).queries ?? [],
              });
            } else if (nodeName === "search") {
              send("search", {
                results: (
                  statePartial as {
                    results?: { query: string; content: string; url?: string }[];
                  }
                ).results ?? [],
              });
            } else if (nodeName === "reflect") {
              send("reflect", {
                reflection:
                  (statePartial as { reflection?: string }).reflection ?? "",
                iterations:
                  (statePartial as { iterations?: number }).iterations ?? 0,
              });
            } else if (nodeName === "synthesize") {
              send("synthesize", {
                answer: (statePartial as { answer?: string }).answer ?? "",
              });
            }
          }
        }

        send("done", null);
      } catch (err) {
        console.error("[api] Error in deepsearch stream:", err);
        const message = err instanceof Error ? err.message : String(err);
        const line = `data: ${JSON.stringify({ event: "error", data: message })}\n\n`;
        controller.enqueue(encoder.encode(line));
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
