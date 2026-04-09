import { ChatOpenAI } from "@langchain/openai";
import { SearchStateType } from "../state";

const MAX_ITERATIONS = 3;
const MODEL = "gpt-4o";

const model = new ChatOpenAI({ model: MODEL, temperature: 0 });

export async function reflectionNode(
  state: SearchStateType
): Promise<Partial<SearchStateType>> {
  const newIterations = state.iterations + 1;
  console.log("[reflector] Iteration:", newIterations);

  // Hard cap: stop looping
  if (newIterations >= MAX_ITERATIONS) {
    console.log("[reflector] Max iterations reached, forcing synthesize");
    return {
      reflection: "Max iterations reached. Synthesizing with available data.",
      queries: [],
      iterations: newIterations,
    };
  }

  const resultsSummary = state.results
    .map((r) => `[${r.query}] (${r.url}): ${r.content.slice(0, 300)}`)
    .join("\n\n");

  const systemPrompt = `You are a research quality evaluator. Assess whether the gathered research sufficiently answers the question.
Respond ONLY with valid JSON in this exact format:
{
  "sufficient": true | false,
  "gaps": ["gap query 1", "gap query 2"],
  "reflection": "brief assessment of what we have and what is missing"
}
No markdown fences. No explanation outside the JSON.`;

  const userPrompt = `Question: ${state.question}

Research gathered so far:
${resultsSummary}

Is this sufficient to write a comprehensive answer? If not, what specific queries would fill the gaps?`;

  const response = await model.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  let parsed = { sufficient: true, gaps: [] as string[], reflection: "" };
  try {
    const text = (response.content as string).trim();
    parsed = JSON.parse(text);
    console.log("[reflector] sufficient:", parsed.sufficient, "gaps:", parsed.gaps);
  } catch (e) {
    console.error("[reflector] Failed to parse JSON, defaulting to sufficient", e);
  }

  return {
    reflection: parsed.reflection,
    queries: parsed.sufficient ? [] : parsed.gaps,
    iterations: newIterations,
  };
}
