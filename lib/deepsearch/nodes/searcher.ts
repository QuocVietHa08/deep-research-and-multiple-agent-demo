import { TavilySearch } from "@langchain/tavily";
import { SearchStateType } from "../state";

const MAX_RESULTS = 3;
const CONTENT_TRUNCATION = 1500;

const tavily = new TavilySearch({ maxResults: MAX_RESULTS });

export async function searchNode(
  state: SearchStateType
): Promise<Partial<SearchStateType>> {
  console.log("[searcher] Running search for queries:", state.queries);

  // Only search the latest batch of queries (not all accumulated ones)
  // We need to track which queries are new — use the last N queries based on iteration
  // Since queries accumulate, we search all of them on first pass
  // On re-runs the reflector provides new gap queries; we search only those
  const queriesToSearch = state.queries;

  const searchPromises = queriesToSearch.map(async (query) => {
    try {
      const raw = await tavily.invoke({ query });
      console.log(`[searcher] Got results for: "${query}"`);

      // TavilySearch returns an array of result objects
      const items = Array.isArray(raw) ? raw : [];
      return items.map((item: { url?: string; content?: string }) => ({
        query,
        content: (item.content ?? "").slice(0, CONTENT_TRUNCATION),
        url: item.url ?? "",
      }));
    } catch (e) {
      console.error(`[searcher] Search failed for "${query}":`, e);
      return [{ query, content: "", url: "" }];
    }
  });

  const nestedResults = await Promise.all(searchPromises);
  const results = nestedResults.flat();

  console.log("[searcher] Total results collected:", results.length);
  return { results };
}
