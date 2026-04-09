import { NextRequest } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import "@/lib/deepresearch/langsmith";
import { agentGraph } from "@/lib/agent/graph";
import { deepResearchGraph } from "@/lib/deepresearch/orchestrator";
import { canvasGraph } from "@/lib/canvas/graph";
import { canvasToolStore } from "@/lib/shared/tools";

export const runtime = "nodejs";

type Mode = "agent" | "deepresearch" | "canvas";

// ── Helper: extract the value of the "content" key from a partial JSON string ──
// The LLM streams tool args token-by-token; this pulls out content as it arrives.
function extractCanvasContent(partialArgs: string): string {
  const keyIdx = partialArgs.indexOf('"content"');
  if (keyIdx === -1) return "";

  const colonIdx = partialArgs.indexOf(":", keyIdx + 9);
  if (colonIdx === -1) return "";

  // Skip whitespace + opening quote
  let i = colonIdx + 1;
  while (i < partialArgs.length && partialArgs[i] !== '"') i++;
  if (i >= partialArgs.length) return "";
  i++; // skip opening quote

  let result = "";
  while (i < partialArgs.length) {
    const ch = partialArgs[i];
    if (ch === '"') break; // closing quote — string ended cleanly
    if (ch === "\\" && i + 1 < partialArgs.length) {
      const esc = partialArgs[i + 1];
      if (esc === "n") { result += "\n"; i += 2; continue; }
      if (esc === "t") { result += "\t"; i += 2; continue; }
      if (esc === "r") { result += "\r"; i += 2; continue; }
      if (esc === '"') { result += '"'; i += 2; continue; }
      if (esc === "\\") { result += "\\"; i += 2; continue; }
      result += esc; i += 2; continue;
    }
    result += ch;
    i++;
  }
  return result;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const message = String(body?.message ?? "").trim();
  const mode = String(body?.mode ?? "agent") as Mode;
  const threadId = String(body?.threadId ?? "").trim();
  const selectedText = body?.selectedText
    ? String(body.selectedText).slice(0, 5000)
    : null;

  if (!message) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!["agent", "deepresearch", "canvas"].includes(mode)) {
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
        } else if (mode === "canvas") {
          await runCanvasStream({ message, threadId, selectedText, send });
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
    { messages: [new HumanMessage(`${message}\n\n[System Info: Current threadId is "${threadId}". Pass this strictly when using canvas_write or canvas_update.]`)] },
    {
      streamMode: "messages",
      configurable: { thread_id: threadId || `thread-${Date.now()}` },
    }
  );

  let finalText = "";
  let inFinalAnswer = false;

  // ── Per-slot accumulator for streaming canvas tool args ────────────────────
  // Each canvas tool call occupies a slot index (0, 1, …). We accumulate
  // the raw JSON args string and progressively extract the "content" value.
  type SlotState = { name: string; accArgs: string; prevContentLen: number };
  const toolSlots = new Map<number, SlotState>();

  for await (const [msgChunk, metadata] of eventStream) {
    const langgraphNode = (metadata as any)?.langgraph_node as string | undefined;
    const content = typeof msgChunk?.content === "string" ? msgChunk.content : "";

    // ── Stream canvas tool args token-by-token (tool_call_chunks) ─────────
    const toolCallChunks = Array.isArray((msgChunk as any)?.tool_call_chunks)
      ? ((msgChunk as any).tool_call_chunks as Array<{
          name?: string;
          args?: string;
          index?: number;
        }>)
      : [];

    for (const chunk of toolCallChunks) {
      const idx = chunk.index ?? 0;
      const chunkArgs = chunk.args ?? "";

      if (chunk.name) {
        // First chunk for this slot — initialise tracking
        const slot: SlotState = { name: chunk.name, accArgs: chunkArgs, prevContentLen: 0 };
        toolSlots.set(idx, slot);

        if (chunk.name === "canvas_write" || chunk.name === "canvas_update") {
          // Open the canvas panel immediately — before content arrives
          send("canvas_open", null);
        }
      } else {
        const slot = toolSlots.get(idx);
        if (!slot) continue;
        slot.accArgs += chunkArgs;

        if (slot.name === "canvas_write" || slot.name === "canvas_update") {
          // Extract what we've seen so far of the content field
          const extracted = extractCanvasContent(slot.accArgs);
          if (extracted.length > slot.prevContentLen) {
            const delta = extracted.slice(slot.prevContentLen);
            send("artifact_chunk", { delta });
            slot.prevContentLen = extracted.length;
          }
        }
      }
    }

    // ── Complete tool calls (finalized after model finishes the call) ──────
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

    // ── Tool result (observation) from the tools node ──────────────────────
    if (langgraphNode === "tools") {
      const toolMsg = msgChunk as any;
      if (toolMsg.name === "canvas_write" || toolMsg.name === "canvas_update") {
        const artifact = canvasToolStore.get(threadId);
        if (artifact) {
          // Final artifact replaces the streamed content
          send("artifact", artifact);
        }
      }
      send("observation", { name: toolMsg.name || "tool", result: content });
      continue;
    }

    // ── Token from the agent node — stream it ─────────────────────────────
    if (langgraphNode === "agent" && content) {
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


async function runCanvasStream({
  message,
  threadId,
  selectedText,
  send,
}: {
  message: string;
  threadId: string;
  selectedText: string | null;
  send: (event: string, data: unknown) => void;
}) {
  const eventStream = await canvasGraph.stream(
    {
      messages: [new HumanMessage(message)],
      selectedText: selectedText ?? null,
    },
    {
      streamMode: "updates",
      configurable: { thread_id: threadId || `canvas-${Date.now()}` },
    }
  );

  for await (const chunk of eventStream) {
    for (const [nodeName, update] of Object.entries(chunk)) {
      const partial = update as any;

      if (nodeName === "router" && partial?.nextAction) {
        send("routing", { action: partial.nextAction });
      }

      if (
        (nodeName === "generateArtifact" || nodeName === "updateArtifact") &&
        partial?.artifact
      ) {
        send("artifact", partial.artifact);
      }

      if (nodeName === "replyToChat") {
        const lastMsg = Array.isArray(partial?.messages)
          ? partial.messages.at(-1)
          : null;
        if (lastMsg?.content) {
          send("chat", { text: String(lastMsg.content) });
        }
      }
    }
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
