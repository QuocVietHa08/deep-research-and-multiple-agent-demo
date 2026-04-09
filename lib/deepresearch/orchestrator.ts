import { END, Send, StateGraph } from "@langchain/langgraph";
import { ResearchState } from "./state";
import { outlinePlannerNode } from "./nodes/outlinePlanner";
import { editorNode } from "./nodes/editor";
import { assemblerNode } from "./nodes/assembler";
import { topicAgentGraph } from "./agent/graph";

const orchestrator = new StateGraph(ResearchState)
  .addNode("outlinePlanner", outlinePlannerNode)
  .addNode("topicAgent", topicAgentGraph)
  .addNode("editor", editorNode)
  .addNode("assembler", assemblerNode)
  .addEdge("__start__", "outlinePlanner")
  // Fan out one `topicAgent` per outline section (parallel)
  .addConditionalEdges("outlinePlanner", (state) =>
    state.outline.map(
      (section) =>
        new Send("topicAgent", {
          section: section.title,
          guidingQuestions: section.guidingQuestions,
          globalTopic: state.topic,
        })
    )
  )
  .addEdge("topicAgent", "editor")
  .addEdge("editor", "assembler")
  .addEdge("assembler", END);

export const deepResearchGraph = orchestrator.compile();

