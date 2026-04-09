import { ChatOpenAI } from "@langchain/openai";
import { AIMessage } from "@langchain/core/messages";
import type { CanvasStateType } from "../state";

const model = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0.5 });

export async function replyToChatNode(
  state: CanvasStateType
): Promise<Partial<CanvasStateType>> {
  const res = await model.invoke([
    {
      role: "system",
      content: `You are a helpful writing assistant. Answer the user's question conversationally.
${state.artifact ? `Context: the user is working on a ${state.artifact.type} artifact titled "${state.artifact.title}".` : ""}`,
    },
    ...state.messages,
  ]);

  console.log("[replyToChat] generated reply:", (res.content as string).slice(0, 80));

  return { messages: [new AIMessage(res.content as string)] };
}
