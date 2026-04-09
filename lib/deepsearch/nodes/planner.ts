import { ChatOpenAI } from "@langchain/openai";
import { SearchStateType } from "../state";

const MAX_QUERIES = 4;
const MODEL = "gpt-4o";

const model = new ChatOpenAI({ model: MODEL, temperature: 0 });

export async function plannerNode(
  state: SearchStateType
): Promise<Partial<SearchStateType>> {
  console.log("[planner] Running planner node, iteration:", state.iterations);

  const hasResults = state.results.length > 0;

  const systemPrompt = `You are a research planner. Your job is to decompose a question into ${MAX_QUERIES} or fewer focused, distinct search queries.
Return ONLY a raw JSON array of strings. No markdown, no explanation, no code fences.
Example: ["query one", "query two", "query three"]`;

  const userPrompt = hasResults
    ? `Question: ${state.question}

Already gathered research (summarized):
${state.results
  .slice(-9)
  .map((r) => `- [${r.query}]: ${r.content.slice(0, 200)}`)
  .join("\n")}

Generate only queries that fill gaps not covered by the above research.`
    : `Question: ${state.question}

Generate ${MAX_QUERIES} focused search queries to answer this question.`;

  const response = await model.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  let queries: string[] = [];
  try {
    const text = response.content as string;
    queries = JSON.parse(text.trim());
    console.log("[planner] Generated queries:", queries);
  } catch (e) {
    console.error("[planner] Failed to parse queries, using fallback", e);
    queries = [state.question];
  }

  return { queries };
}
