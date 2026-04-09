import { ChatOpenAI } from "@langchain/openai";
import type { CanvasStateType } from "../state";

const model = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });

export async function routerNode(
  state: CanvasStateType
): Promise<Partial<CanvasStateType>> {
  const lastMessage = state.messages.at(-1);
  const userContent =
    typeof lastMessage?.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage?.content ?? "");

  const hasArtifact = state.artifact !== null;

  const res = await model.invoke([
    {
      role: "system",
      content: `Classify the user's intent. Return ONLY one word:
- "generate"  → user wants to create a new document or code file
- "update"    → user wants to edit, improve, or change the existing artifact
- "reply"     → conversational message, no artifact change needed

${hasArtifact ? `Current artifact type: ${state.artifact!.type}` : "No artifact exists yet."}
Return ONLY the word. No punctuation, no explanation.`,
    },
    { role: "user", content: userContent },
  ]);

  const raw = (res.content as string).trim().toLowerCase();
  const validActions = ["generate", "update", "reply"] as const;
  const action = validActions.includes(raw as (typeof validActions)[number])
    ? (raw as "generate" | "update" | "reply")
    : hasArtifact
      ? "update"
      : "generate";

  console.log("[router] classified action:", action, "| raw:", raw);

  return { nextAction: action };
}
