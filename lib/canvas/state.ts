import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

export type ArtifactType = "markdown" | "code";

export type ArtifactVersion = {
  id: string;
  content: string;
  type: ArtifactType;
  language?: string; // e.g. "typescript", "python"
  title: string;
  createdAt: number;
};

export const CanvasState = Annotation.Root({
  ...MessagesAnnotation.spec,

  // Current artifact (null = no artifact yet this session)
  artifact: Annotation<ArtifactVersion | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  // All versions for time-travel navigation
  artifactVersions: Annotation<ArtifactVersion[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),

  // Router decision passed between nodes
  nextAction: Annotation<"generate" | "update" | "reply" | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  // Selected text from the canvas (for partial edits)
  selectedText: Annotation<string | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  // User memory: style preferences extracted by reflectMemory node
  userMemory: Annotation<string>({
    reducer: (_, b) => b,
    default: () => "",
  }),
});

export type CanvasStateType = typeof CanvasState.State;
