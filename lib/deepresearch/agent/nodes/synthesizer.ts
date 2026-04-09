import { ChatOpenAI } from "@langchain/openai";
import type { AgentStateType } from "../../agent/state";

const model = new ChatOpenAI({ model: "gpt-4o", temperature: 0.4 });

export async function agentSynthesizerNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const context =
    state.results.length > 0
      ? state.results
          .map((r) => `Source URL: ${r.url}\nQuery: ${r.query}\n\n${r.content}`)
          .join("\n\n---\n\n")
      : "";

  const allowedUrls = Array.from(
    new Set(state.results.map((r) => String(r.url ?? "").trim()).filter(Boolean))
  );

  const res = await model.invoke([
    {
      role: "system",
      content: `You are a research writer. Write a thorough, well-cited section for a research report.

Requirements:
- Use inline citations in the exact form: [source: <url>]
- Only include claims supported by the provided research context. Do not hallucinate.
- When you add a citation, the URL inside [source: ...] MUST be one of the provided Allowed source URLs.
- Target 400–600 words.
- Keep writing in clear prose with good paragraphing.`,
    },
    {
      role: "user",
      content: `Report topic: ${state.globalTopic}
Section title: ${state.section}
Guiding questions: ${state.guidingQuestions.join("; ")}

Allowed source URLs (citations must use only these):
${allowedUrls.join("\n")}

Research context:
${context}`,
    },
  ]);

  const content = res.content as string;

  const uniqueByUrl = new Map<string, string>();
  for (const r of state.results) {
    if (!r.url) continue;
    if (!uniqueByUrl.has(r.url)) uniqueByUrl.set(r.url, r.query);
  }

  const citations = Array.from(uniqueByUrl.entries()).map(([url, title]) => ({
    url,
    title,
  }));

  const subReport = {
    section: state.section,
    content,
    citations,
  };

  return { subReport, subReports: [subReport] };
}

