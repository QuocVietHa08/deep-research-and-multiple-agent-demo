import { ChatOpenAI } from "@langchain/openai";
import type { ResearchStateType } from "../state";

const model = new ChatOpenAI({ model: "gpt-4o", temperature: 0.5 });

function uniqueCitations(state: ResearchStateType) {
  const byUrl = new Map<string, string>();
  for (const r of state.subReports) {
    for (const c of r.citations) {
      const url = String(c.url ?? "").trim();
      if (!url) continue;
      if (!byUrl.has(url)) byUrl.set(url, String(c.title ?? "Source"));
    }
  }
  return byUrl;
}

function normalizeUrl(url: string) {
  return url
    .trim()
    // strip surrounding angle brackets if present
    .replace(/^<+/, "")
    .replace(/>+$/, "")
    // remove trailing punctuation that sometimes sneaks in
    .replace(/[.,;:)\]]+$/, "");
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function assemblerNode(
  state: ResearchStateType
): Promise<Partial<ResearchStateType>> {
  const sections =
    state.subReports.length > 0
      ? state.subReports
          .map((r) => `## ${r.section}\n\n${r.content}`)
          .join("\n\n---\n\n")
      : "";

  const byUrl = uniqueCitations(state);
  const urls = Array.from(byUrl.keys());
  const numericMapping = urls
    .map((url, idx) => `[${idx + 1}] ${byUrl.get(url) ?? "Source"} — ${url}`)
    .join("\n");
  const referencesMarkdown = urls
    .map(
      (url, idx) =>
        `${idx + 1}. [${byUrl.get(url) ?? "Source"}](${url})`
    )
    .join("\n");

  const res = await model.invoke([
    {
      role: "system",
      content: `You are a research editor. Assemble the provided sections into a polished, coherent long-form research report in markdown.

Rules:
- Do not add new factual claims not present in the sections.
- Preserve all section content, lightly editing only for flow/clarity.
- The section text may contain inline citations placeholders like: [source: <url>]
- Keep citations in the placeholder form (do NOT convert them to numeric [n] here).
- Output MUST be markdown only. No JSON, no markdown fences.

The final report must include:
- Title at the top
- An executive summary (~150 words)
- The assembled section body
- A references section at the end (heading: "## References")
`,
    },
    {
      role: "user",
      content: `Topic: ${state.topic}
Editor notes: ${state.editorNotes}

Numeric citation mapping:
${numericMapping}

Sections (citations are still in [source: <url>] form):
${sections}
`,
    },
  ]);

  const rawFinal = (res.content ?? "") as string;

  // Replace citations deterministically in code so numbers always match `references`.
  const urlToIndex = new Map<string, number>();
  urls.forEach((u, idx) => {
    urlToIndex.set(normalizeUrl(u), idx + 1);
    urlToIndex.set(u, idx + 1);
  });

  const replaced = rawFinal.replace(
    /\[source:\s*<?([^>\]]+?)>?\s*\]/g,
    (_match, capturedUrl: string) => {
      const key = normalizeUrl(String(capturedUrl));
      const idx = urlToIndex.get(key);
      return idx ? `[${idx}]` : "[?]";
    }
  );

  // Overwrite references section to ensure count matches the mapping we used.
  const finalWithReferences = replaced.replace(
    /##\s*References[\s\S]*/m,
    ""
  );


  return {
    finalReport:
      (finalWithReferences.trim() ? finalWithReferences.trim() + "\n\n" : "") +
      `## References\n${referencesMarkdown}\n`,
  };
}

