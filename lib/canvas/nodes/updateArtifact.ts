import { ChatOpenAI } from "@langchain/openai";
import { v4 as uuid } from "uuid";
import type { CanvasStateType, ArtifactVersion } from "../state";

const model = new ChatOpenAI({ model: "gpt-4o", temperature: 0.3 });

export async function updateArtifactNode(
  state: CanvasStateType
): Promise<Partial<CanvasStateType>> {
  const { artifact, selectedText, messages, userMemory } = state;
  if (!artifact) return {};

  const lastMessage = messages.at(-1);
  const instruction =
    typeof lastMessage?.content === "string" ? lastMessage.content : "";

  const isPartialEdit = !!selectedText && selectedText.trim().length > 0;

  console.log("[updateArtifact] isPartialEdit:", isPartialEdit, "| selectedText length:", selectedText?.length ?? 0);

  const systemPrompt = isPartialEdit
    ? `You are an editor. The user selected this text:

"${selectedText!.slice(0, 5000)}"

Apply their instruction to ONLY that selection. Return ONLY the replacement text for the selection. Do not repeat the full document.`
    : `You are an editor. Rewrite the entire artifact based on the user's instruction.
Return ONLY the full updated artifact content — no preamble, no explanation.
${userMemory ? `\nUser preferences:\n${userMemory}` : ""}

Current artifact:
${artifact.content}`;

  const res = await model.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: instruction },
  ]);

  const updatedContent = isPartialEdit
    ? artifact.content.replace(selectedText!, res.content as string)
    : (res.content as string);

  const newVersion: ArtifactVersion = {
    ...artifact,
    id: uuid(),
    content: updatedContent,
    createdAt: Date.now(),
  };

  // Prune if over limit
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
  };
}
