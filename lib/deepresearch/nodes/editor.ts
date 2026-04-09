import { ChatOpenAI } from "@langchain/openai";
import type { ResearchStateType } from "../state";

const model = new ChatOpenAI({ model: "gpt-4o", temperature: 0.2 });

export async function editorNode(
  state: ResearchStateType
): Promise<Partial<ResearchStateType>> {
  const reportSummary =
    state.subReports.length > 0
      ? state.subReports
          .map((r) => `## ${r.section}\n${r.content}`)
          .join("\n\n---\n\n")
      : "";

  const res = await model.invoke([
    {
      role: "system",
      content: `You are a senior editor reviewing a multi-section research report.

Check for:
1) duplicated content across sections,
2) sections that are too thin or off-topic,
3) inconsistent citation format.

Return JSON only:
{
  "notes": string,
  "sectionsToRevise": string[]
}
No markdown fences.`,
    },
    {
      role: "user",
      content: `Topic: ${state.topic}\n\nDraft report:\n${reportSummary}`,
    },
  ]);

  try {
    const parsed = JSON.parse(String(res.content ?? "").trim());
    return { editorNotes: String(parsed?.notes ?? "") };
  } catch {
    // Fall back to whatever we got.
    return { editorNotes: String(res.content ?? "") };
  }
}

