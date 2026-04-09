import { ChatOpenAI } from "@langchain/openai";
import type { AgentStateType } from "../../agent/state";

const MAX_ITERATIONS = 2;

const model = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });

export async function agentReflectorNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const newIterations = state.iterations + 1;

  // Build a compact research summary for the critic.
  const summary =
    state.results.length > 0
      ? state.results
          .slice(-8)
          .map((r) => `[${r.url}]\n${r.content}`)
          .join("\n---\n")
      : "";

  const systemPrompt = `You are a research critic. Evaluate whether the gathered information fully answers the guiding questions for a specific section.
Respond ONLY with valid JSON in this exact format:
{
  "sufficient": boolean,
  "gaps": string[],
  "reflection": string
}
No markdown fences.`;

  const userPrompt = `Global topic: ${state.globalTopic}
Section: ${state.section}
Guiding questions: ${state.guidingQuestions.join("; ")}

Research gathered:
${summary}`;

  let parsed: { sufficient: boolean; gaps: string[]; reflection: string } = {
    sufficient: true,
    gaps: [],
    reflection: "Sufficient or insufficient could not be determined; stopping.",
  };

  try {
    const response = await model.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const raw = String(response.content ?? "");
    parsed = JSON.parse(raw.trim());
  } catch {
    // Fail open: stop looping rather than getting stuck on invalid JSON.
    parsed = {
      sufficient: true,
      gaps: [],
      reflection:
        "Reflection JSON could not be parsed; stopping with available data.",
    };
  }

  const shouldStop =
    parsed.sufficient === true || newIterations >= MAX_ITERATIONS;

  return {
    reflection: parsed.reflection,
    queries: shouldStop ? [] : parsed.gaps,
    iterations: newIterations,
  };
}

