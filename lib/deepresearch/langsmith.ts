/**
 * LangSmith tracing setup.
 *
 * LangChain's instrumentation primarily reads env vars at runtime.
 * We set safe defaults for tracing/project if the user provided an API key.
 */
export function ensureLangSmithTracing() {
  const apiKey = process.env.LANGCHAIN_API_KEY;
  if (!apiKey) return;

  // Enable tracing for all LangChain/LangGraph calls.
  if (!process.env.LANGCHAIN_TRACING_V2) {
    process.env.LANGCHAIN_TRACING_V2 = "true";
  }

  // Provide a stable default project name (override in your `.env.local` if desired).
  if (!process.env.LANGCHAIN_PROJECT) {
    process.env.LANGCHAIN_PROJECT = "deepresearch-v1";
  }
}

// Side-effect import style: `import "@/lib/deepresearch/langsmith"`
ensureLangSmithTracing();

