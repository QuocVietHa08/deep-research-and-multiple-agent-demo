import { ChatOpenAI } from "@langchain/openai";
import { AIMessage } from "@langchain/core/messages";
import { v4 as uuid } from "uuid";
import type { CanvasStateType, ArtifactVersion } from "../state";

const model = new ChatOpenAI({ model: "gpt-4o", temperature: 0.5 });

const CODE_INTENT_RE =
  /\b(code|function|class|script|component|implement|write a program|snippet)\b/i;

export async function generateArtifactNode(
  state: CanvasStateType
): Promise<Partial<CanvasStateType>> {
  const lastMessage = state.messages.at(-1);
  const userMsg =
    typeof lastMessage?.content === "string" ? lastMessage.content : "";

  const isCode = CODE_INTENT_RE.test(userMsg);

  console.log("[generateArtifact] isCode:", isCode, "| userMsg snippet:", userMsg.slice(0, 60));

  const res = await model.invoke([
    {
      role: "system",
      content: `You are a writing and coding assistant. Generate a high-quality artifact based on the user's request.
${state.userMemory ? `\nUser preferences:\n${state.userMemory}` : ""}

Respond with ONLY the artifact content — no preamble, no explanation, no markdown fences.
The content will be displayed directly in an editor.`,
    },
    { role: "user", content: userMsg },
  ]);

  const content = res.content as string;
  const title =
    userMsg.slice(0, 60).replace(/[^a-zA-Z0-9 ]/g, "").trim() || "Untitled";

  const newVersion: ArtifactVersion = {
    id: uuid(),
    content,
    type: isCode ? "code" : "markdown",
    language: isCode ? "typescript" : undefined,
    title,
    createdAt: Date.now(),
  };

  // Prune versions if we're approaching the limit
  const currentVersions = state.artifactVersions ?? [];
  const pruned =
    currentVersions.length >= 50
      ? currentVersions.slice(-49)
      : currentVersions;

  return {
    artifact: newVersion,
    artifactVersions: pruned.length < currentVersions.length
      ? [...pruned, newVersion]
      : [newVersion],
    messages: [
      new AIMessage(`I've created a new ${newVersion.type} artifact titled "${title}".`),
    ],
  };
}
