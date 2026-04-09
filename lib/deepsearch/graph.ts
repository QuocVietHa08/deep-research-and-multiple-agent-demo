import { StateGraph, END } from "@langchain/langgraph";
import { SearchState } from "./state";
import { plannerNode } from "./nodes/planner";
import { searchNode } from "./nodes/searcher";
import { reflectionNode } from "./nodes/reflector";
import { synthesisNode } from "./nodes/synthesizer";

const graph = new StateGraph(SearchState)
  .addNode("planner", plannerNode)
  .addNode("search", searchNode)
  .addNode("reflect", reflectionNode)
  .addNode("synthesize", synthesisNode)

  .addEdge("__start__", "planner")
  .addEdge("planner", "search")
  .addEdge("search", "reflect")

  // If reflector produced gap queries → loop back to planner; else → synthesize
  .addConditionalEdges("reflect", (state) =>
    state.queries.length > 0 ? "planner" : "synthesize"
  )

  .addEdge("synthesize", END);

export const deepsearchGraph = graph.compile();
