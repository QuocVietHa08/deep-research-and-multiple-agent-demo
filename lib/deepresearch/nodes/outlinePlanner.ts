import { ChatOpenAI } from "@langchain/openai";
import type { ResearchStateType } from "../state";

const MIN_SECTIONS = 3;
const MAX_SECTIONS = 6;

const model = new ChatOpenAI({ model: "gpt-4o", temperature: 0.3 });

function fallbackOutline(topic: string) {
  return [
    {
      title: "Overview",
      guidingQuestions: [
        `What is ${topic}, and what does “understanding it” look like?`,
        "What are the most important terms and concepts to know first?",
      ],
      depth: "shallow" as const,
    },
    {
      title: "Key Developments",
      guidingQuestions: [
        `What are the most significant developments related to ${topic}?`,
        "What evidence or data best supports these developments?",
      ],
      depth: "deep" as const,
    },
    {
      title: "Open Questions & Implications",
      guidingQuestions: [
        `What uncertainties or unresolved questions remain about ${topic}?`,
        "What practical implications follow from what we know?",
      ],
      depth: "deep" as const,
    },
  ];
}

export async function outlinePlannerNode(
  state: ResearchStateType
): Promise<Partial<ResearchStateType>> {
  const topic = state.topic;

  const res = await model.invoke([
    {
      role: "system",
      content: `You are a research director. Given a broad topic, produce a structured research outline.

Return ONLY a valid JSON array (no markdown fences). Each element must match:
{
  "title": string,
  "guidingQuestions": string[],
  "depth": "shallow" | "deep"
}

Guidelines:
- Create between ${MIN_SECTIONS} and ${MAX_SECTIONS} sections (inclusive).
- Each section needs 2–3 guiding questions.`,
    },
    { role: "user", content: `Research topic: ${topic}` },
  ]);

  try {
    const parsed = JSON.parse(String(res.content ?? "").trim());
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { outline: fallbackOutline(topic) };
    }

    type CandidateSection = {
      title: string;
      guidingQuestions: string[];
      depth: "shallow" | "deep";
    };

    const normalized: CandidateSection[] = (parsed as any[]).map((s: any) => {
      const depth: CandidateSection["depth"] =
        s?.depth === "shallow" ? "shallow" : "deep";
      const guidingQuestions = Array.isArray(s?.guidingQuestions)
        ? s.guidingQuestions.map(String).filter(Boolean).slice(0, 3)
        : [];

      const title = String(s?.title ?? "").trim();
      if (!title) return null;

      return {
        title,
        guidingQuestions,
        depth,
      };
    }).filter((s): s is CandidateSection => s !== null);

    const trimmed =
      normalized.length > MAX_SECTIONS
        ? normalized.slice(0, MAX_SECTIONS)
        : normalized;

    if (trimmed.length < MIN_SECTIONS) {
      // If the model under-produced sections, pad with a fallback.
      const padded = fallbackOutline(topic);
      return { outline: [...trimmed, ...padded].slice(0, MAX_SECTIONS) };
    }

    return { outline: trimmed };
  } catch {
    return { outline: fallbackOutline(topic) };
  }
}

