import { ChatOpenAI } from "@langchain/openai";
import type { CanvasStateType } from "../state";

const model = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });

export async function reflectMemoryNode(
  state: CanvasStateType
): Promise<Partial<CanvasStateType>> {
  const recentMessages = state.messages.slice(-6);
  if (recentMessages.length === 0) return {};

  const res = await model.invoke([
    {
      role: "system",
      content: `Extract style preferences and user facts from this conversation.
Examples: "prefers concise writing", "uses British English", "writes TypeScript with strict types".
Return a short bullet list (max 5 bullets), or an empty string if nothing notable.
Existing memory:
${state.userMemory || "(none)"}`,
    },
    ...recentMessages,
  ]);

  const newMemory = (res.content as string).trim();
  if (!newMemory) return {};

  console.log("[reflectMemory] updated memory:", newMemory.slice(0, 80));

  return { userMemory: newMemory };
}
