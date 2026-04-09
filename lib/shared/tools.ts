import { TavilySearch } from "@langchain/tavily";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const tavily = new TavilySearch({ maxResults: 5 });

export const searchTool = tool(
  async ({ query }: { query: string }) => {
    const raw = await tavily.invoke({ query });
    return JSON.stringify(raw);
  },
  {
    name: "search_web",
    description: "Search the web for up-to-date information.",
    schema: z.object({
      query: z.string().min(2),
    }),
  }
);

export const allTools = [searchTool];

