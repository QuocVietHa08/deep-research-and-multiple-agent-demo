import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { allTools } from "../shared/tools";

const llm = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0.2,
  maxRetries: 3,
});

const memory = new MemorySaver();

export const agentGraph = createReactAgent({
  llm,
  tools: allTools,
  checkpointSaver: memory,
  messageModifier: `You are a concise research assistant.
- Think step-by-step.
- Use tools when current data is needed.
- Cite sources inline like [source: https://...].
- Keep answers clear and practical.`,
});

