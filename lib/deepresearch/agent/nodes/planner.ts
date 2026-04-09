import { ChatOpenAI } from "@langchain/openai";
import type { AgentStateType } from "../../agent/state";

const MODEL = "gpt-4o-mini";
const MAX_QUERIES = 3;

const model = new ChatOpenAI({ model: MODEL, temperature: 0 });

export async function agentPlannerNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const existingContext =
    state.results.length > 0
      ? `\nAlready gathered:\n${state.results
          .slice(-8)
          .map((r) => `[${r.url}]\n${r.content}`)
          .join("\n\n")}`
      : "";

  const res = await model.invoke([
    {
      role: "system",
      content: `You are a research assistant. Generate ${MAX_QUERIES} focused search queries to answer the guiding questions for a specific section of a research report.
Return ONLY a JSON array of query strings. No markdown fences.`,
    },
    {
      role: "user",
      content: `Global topic: ${state.globalTopic}
Section: ${state.section}
Guiding questions: ${state.guidingQuestions.join("; ")}${existingContext}`,
    },
  ]);

  let queries: string[] = [];
  try {
    const raw = String(res.content ?? "");
    queries = JSON.parse(raw.trim());
  } catch {
    // Fallback: at least do something rather than infinite-looping on invalid JSON
    queries = [state.guidingQuestions[0] ?? state.section];
  }

  // Keep within max bounds even if the model overshoots
  queries = Array.from(new Set(queries)).slice(0, MAX_QUERIES);
  return { queries };
}

