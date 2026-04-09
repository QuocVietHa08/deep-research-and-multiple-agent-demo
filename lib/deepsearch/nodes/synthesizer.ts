import { ChatOpenAI } from "@langchain/openai";
import { SearchStateType } from "../state";

const MODEL = "gpt-4o";
const SYNTHESIS_MAX_TOKENS = 1024;

const model = new ChatOpenAI({
  model: MODEL,
  temperature: 0.3,
  maxTokens: SYNTHESIS_MAX_TOKENS,
});

export async function synthesisNode(
  state: SearchStateType
): Promise<Partial<SearchStateType>> {
  console.log("[synthesizer] Synthesizing answer from", state.results.length, "results");

  const researchContext = state.results
    .map((r) => `Source: ${r.url}\nQuery: ${r.query}\n${r.content}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are a research synthesizer. Write a comprehensive, well-structured answer based strictly on the provided research.

Guidelines:
- Cite sources inline using [source: url] notation
- Structure with a brief intro, key findings, and conclusion
- Do NOT hallucinate — only include claims supported by the research
- Target 300–600 words
- Use clear, readable prose`;

  const userPrompt = `Question: ${state.question}

Research:
${researchContext}

Write a comprehensive answer with inline citations.`;

  const response = await model.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  const answer = response.content as string;
  console.log("[synthesizer] Answer length:", answer.length, "chars");

  return { answer };
}
