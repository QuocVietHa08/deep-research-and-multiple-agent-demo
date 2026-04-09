import { StateGraph, END } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { CanvasState } from "./state";
import { routerNode } from "./nodes/router";
import { generateArtifactNode } from "./nodes/generateArtifact";
import { updateArtifactNode } from "./nodes/updateArtifact";
import { replyToChatNode } from "./nodes/replyToChat";
import { reflectMemoryNode } from "./nodes/reflectMemory";

const memory = new MemorySaver();

const graph = new StateGraph(CanvasState)
  .addNode("router", routerNode)
  .addNode("generateArtifact", generateArtifactNode)
  .addNode("updateArtifact", updateArtifactNode)
  .addNode("replyToChat", replyToChatNode)
  .addNode("reflectMemory", reflectMemoryNode)

  .addEdge("__start__", "router")

  .addConditionalEdges("router", (state) => {
    if (state.nextAction === "generate") return "generateArtifact";
    if (state.nextAction === "update") return "updateArtifact";
    return "replyToChat";
  })

  // After generate/update: run memory reflection, then end
  .addEdge("generateArtifact", "reflectMemory")
  .addEdge("updateArtifact", "reflectMemory")
  .addEdge("reflectMemory", END)

  // Conversational reply ends immediately
  .addEdge("replyToChat", END);

export const canvasGraph = graph.compile({ checkpointer: memory });
