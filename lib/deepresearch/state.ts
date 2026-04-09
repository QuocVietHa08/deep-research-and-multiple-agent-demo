import { Annotation } from "@langchain/langgraph";

export type Section = {
  title: string;
  guidingQuestions: string[];
  depth: "shallow" | "deep";
};

export type SubReport = {
  section: string;
  content: string;
  citations: { url: string; title: string }[];
  tokenCount?: number;
};

export const ResearchState = Annotation.Root({
  // The original research topic — never mutated
  topic: Annotation<string>(),

  // Structured outline produced by the planner
  outline: Annotation<Section[]>(),

  // Sub-reports accumulated from all parallel agents
  subReports: Annotation<SubReport[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),

  // Editor feedback (overwritten each pass)
  editorNotes: Annotation<string>(),

  // Final assembled markdown report
  finalReport: Annotation<string>(),
});

export type ResearchStateType = typeof ResearchState.State;

