import { NextRequest } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import "@/lib/deepresearch/langsmith";
import { agentGraph } from "@/lib/agent/graph";
import { deepResearchGraph } from "@/lib/deepresearch/orchestrator";

export const runtime = "nodejs";

type Mode = "agent" | "deepresearch";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const message = String(body?.message ?? "").trim();
  const mode = String(body?.mode ?? "agent") as Mode;
  const threadId = String(body?.threadId ?? "").trim();

  if (!message) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (mode !== "agent" && mode !== "deepresearch") {
    return new Response(JSON.stringify({ error: "Invalid mode" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`)
        );

      try {
        if (mode === "agent") {
          await runAgentStream({ message, threadId, send });
        } else {
          await runDeepResearchStream({ topic: message, send });
        }
        send("done", null);
      } catch (e) {
        send("error", e instanceof Error ? e.message : String(e));
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

async function runAgentStream({
  message,
  threadId,
  send,
}: {
  message: string;
  threadId: string;
  send: (event: string, data: unknown) => void;
}) {
  // Use "messages" streamMode to get token-by-token LLM output
  const eventStream = await agentGraph.stream(
    { messages: [new HumanMessage(message)] },
    {
      streamMode: "messages",
      configurable: { thread_id: threadId || `thread-${Date.now()}` },
    }
  );

  let finalText = "";
  let inFinalAnswer = false;

  for await (const [msgChunk, metadata] of eventStream) {
    const langgraphNode = (metadata as any)?.langgraph_node as string | undefined;
    const content = typeof msgChunk?.content === "string" ? msgChunk.content : "";

    // Tool call messages from the agent node — not text tokens
    if (!content) {
      const toolCalls = Array.isArray((msgChunk as any)?.tool_calls)
        ? (msgChunk as any).tool_calls
        : [];
      for (const call of toolCalls) {
        if (call?.name) {
          send("tool", { name: String(call.name), input: call?.args ?? undefined });
        }
      }
      continue;
    }

    // Tool result (observation) from the tools node
    if (langgraphNode === "tools") {
      send("observation", { name: "tool", result: content });
      continue;
    }

    // Token from the agent node — stream it
    if (langgraphNode === "agent") {
      send("token", { text: content });
      finalText += content;
      inFinalAnswer = true;
    }
  }

  // Send the complete final answer for history/storage
  if (inFinalAnswer && finalText) {
    send("answer", { text: finalText });
  }
}

async function runDeepResearchStream({
  topic,
  send,
}: {
  topic: string;
  send: (event: string, data: unknown) => void;
}) {
  const eventStream = await deepResearchGraph.stream(
    { topic },
    { streamMode: "updates" }
  );

  for await (const chunk of eventStream) {
    for (const [nodeName, statePartial] of Object.entries(chunk)) {
      const partial = statePartial as any;

      if (nodeName === "outlinePlanner" && partial?.outline) {
        send("outline", { sections: partial.outline });
      }

      if (nodeName === "topicAgent" && Array.isArray(partial?.subReports)) {
        for (const r of partial.subReports) {
          send("section", {
            title: r.section,
            content: r.content,
            citations: r.citations ?? [],
          });
        }
      }

      if (nodeName === "assembler" && typeof partial?.finalReport === "string") {
        send("answer", { text: partial.finalReport });
      }
    }
  }
}

