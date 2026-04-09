import { END, StateGraph } from "@langchain/langgraph";
import { AgentState } from "./state";
import { agentPlannerNode } from "./nodes/planner";
import { agentSearcherNode } from "./nodes/searcher";
import { agentReflectorNode } from "./nodes/reflector";
import { agentSynthesizerNode } from "./nodes/synthesizer";

const MAX_ITERATIONS = 2;

const agentGraph = new StateGraph(AgentState)
  .addNode("planner", agentPlannerNode)
  .addNode("search", agentSearcherNode)
  .addNode("reflect", agentReflectorNode)
  .addNode("synthesize", agentSynthesizerNode)
  .addEdge("__start__", "planner")
  .addEdge("planner", "search")
  .addEdge("search", "reflect")
  .addConditionalEdges("reflect", (state) =>
    state.iterations >= MAX_ITERATIONS || state.queries.length === 0
      ? "synthesize"
      : "planner"
  )
  .addEdge("synthesize", END);

export const topicAgentGraph = agentGraph.compile();

