import { Annotation } from "@langchain/langgraph";
import type { SubReport } from "../state";

export type SearchResult = {
  query: string;
  content: string;
  url: string;
};

export const AgentState = Annotation.Root({
  // Section assignment passed in via Send
  section: Annotation<string>(),
  guidingQuestions: Annotation<string[]>(),
  globalTopic: Annotation<string>(),

  // Internal loop state
  queries: Annotation<string[]>({
    // IMPORTANT: this must REPLACE, not append.
    // The reflector uses `queries: []` to signal "stop", and if we append,
    // old gap queries remain and the loop never terminates.
    reducer: (_, b) => b,
    default: () => [],
  }),
  results: Annotation<SearchResult[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
  reflection: Annotation<string>(),
  iterations: Annotation<number>({
    reducer: (_, b) => b,
    default: () => 0,
  }),

  // Final output from this agent
  subReport: Annotation<SubReport>(),

  // For integration with the orchestrator graph
  subReports: Annotation<SubReport[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
});

export type AgentStateType = typeof AgentState.State;

