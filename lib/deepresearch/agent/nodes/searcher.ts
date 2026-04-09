import type { AgentStateType } from "../../agent/state";
import { TavilySearch } from "@langchain/tavily";

const MAX_RESULTS = 3;
const CONTENT_TRUNCATION = 1500;
const MAX_QUERIES_PER_ITER = 3;

const tavily = new TavilySearch({ maxResults: MAX_RESULTS });

function extractItems(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.results)) return raw.results;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.items)) return raw.items;
  return [];
}

function extractUrl(item: any): string {
  return String(
    item?.url ??
      item?.link ??
      item?.source ??
      item?.rawUrl ??
      item?.webpageUrl ??
      item?.pageUrl ??
      item?.metadata?.url ??
      item?.metadata?.source ??
      item?.metadata?.pageUrl ??
      item?.metadata?.webpageUrl ??
      item?.result?.url ??
      ""
  ).trim();
}

function extractContent(item: any): string {
  return String(
    item?.content ?? item?.snippet ?? item?.text ?? item?.raw?.content ?? ""
  );
}

export async function agentSearcherNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  // Because `queries` is appended across iterations, only search the latest batch.
  const queriesToSearch = state.queries.slice(-MAX_QUERIES_PER_ITER);

  const resultsNested = await Promise.all(
    queriesToSearch.map(async (query) => {
      try {
        const raw = await tavily.invoke({ query });
        const items = extractItems(raw);

        return items.map((item: any) => ({
          query,
          content: extractContent(item).slice(0, CONTENT_TRUNCATION),
          url: extractUrl(item),
        }));
      } catch {
        // Keep the agent moving even if one search call fails.
        return [{ query, content: "", url: "" }];
      }
    })
  );

  const results = resultsNested.flat();
  return { results };
}

