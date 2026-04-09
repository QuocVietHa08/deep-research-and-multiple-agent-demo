import { TavilySearch } from "@langchain/tavily";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import type { ArtifactVersion } from "@/lib/canvas/state";

const tavily = new TavilySearch({ maxResults: 5 });

export const searchTool = tool(
  async ({ query }: { query: string }) => {
    const raw = await tavily.invoke({ query });
    return JSON.stringify(raw);
  },
  {
    name: "search_web",
    description: "Search the web for up-to-date information.",
    schema: z.object({
      query: z.string().min(2),
    }),
  }
);

// ── Canvas tool output store ───────────────────────────────────────────────────
// Tools inside createReactAgent cannot push directly to the SSE stream.
// Instead, they write their artifact here and the route layer reads + emits it.
// Key = threadId, Value = latest ArtifactVersion produced by the tool.
export const canvasToolStore = new Map<string, ArtifactVersion>();

// ── canvas_write — create a brand-new artifact ────────────────────────────────
export const canvasWriteTool = tool(
  async ({
    title,
    content,
    type,
    language,
    threadId,
  }: {
    title: string;
    content: string;
    type: "markdown" | "code";
    language?: string;
    threadId: string;
  }) => {
    const artifact: ArtifactVersion = {
      id: uuid(),
      title,
      content,
      type,
      language: type === "code" ? (language ?? "typescript") : undefined,
      createdAt: Date.now(),
    };

    canvasToolStore.set(threadId, artifact);

    // Return a short confirmation — the full artifact is read by the route layer.
    return JSON.stringify({
      ok: true,
      artifactId: artifact.id,
      title: artifact.title,
      type: artifact.type,
      charCount: content.length,
    });
  },
  {
    name: "canvas_write",
    description:
      "Create a new document or code artifact in the Canvas panel. " +
      "Use this whenever the user asks you to WRITE, DRAFT, CREATE, or PRODUCE any " +
      "document, blog post, essay, report, README, code file, or script. " +
      "The content will appear in the Canvas panel alongside the chat. " +
      "Do NOT paste the full content in the chat message — always use this tool instead.",
    schema: z.object({
      threadId: z
        .string()
        .describe("The current thread/session ID (pass the threadId you received)."),
      title: z.string().describe("A short, descriptive title for the artifact."),
      content: z.string().describe("The full content of the artifact (markdown or code)."),
      type: z
        .enum(["markdown", "code"])
        .describe("'markdown' for documents/prose, 'code' for code files."),
      language: z
        .string()
        .optional()
        .describe("Programming language for code artifacts, e.g. 'typescript', 'python'."),
    }),
  }
);

// ── canvas_update — update an existing artifact ───────────────────────────────
export const canvasUpdateTool = tool(
  async ({
    title,
    content,
    type,
    language,
    threadId,
  }: {
    title: string;
    content: string;
    type: "markdown" | "code";
    language?: string;
    threadId: string;
  }) => {
    const artifact: ArtifactVersion = {
      id: uuid(),
      title,
      content,
      type,
      language: type === "code" ? (language ?? "typescript") : undefined,
      createdAt: Date.now(),
    };

    canvasToolStore.set(threadId, artifact);

    return JSON.stringify({
      ok: true,
      artifactId: artifact.id,
      title: artifact.title,
      type: artifact.type,
      charCount: content.length,
    });
  },
  {
    name: "canvas_update",
    description:
      "Update the existing Canvas artifact with revised content. " +
      "Use this when the user asks to EDIT, IMPROVE, FIX, REWRITE, TRANSLATE, or UPDATE " +
      "something already in the Canvas. Pass the complete updated content (not just the diff). " +
      "Do NOT paste the revised content in chat — always use this tool.",
    schema: z.object({
      threadId: z
        .string()
        .describe("The current thread/session ID."),
      title: z.string().describe("The artifact title (can be unchanged or updated)."),
      content: z.string().describe("The complete updated content of the artifact."),
      type: z
        .enum(["markdown", "code"])
        .describe("'markdown' or 'code'."),
      language: z
        .string()
        .optional()
        .describe("Programming language for code artifacts."),
    }),
  }
);

export const allTools = [searchTool, canvasWriteTool, canvasUpdateTool];
