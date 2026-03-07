import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentStateAnnotation } from "./state.js";
import { classifierNode } from "./nodes/classifier.js";
import { qaNode } from "./nodes/qa.js";
import { plannerNode } from "./nodes/planner.js";
import { coderNode } from "./nodes/coder.js";
import { executorNode } from "./nodes/executor.js";
import { reviewerNode } from "./nodes/reviewer.js";
import { memoryExtractorNode } from "./nodes/memory-extractor.js";
import type { AgentStateType } from "./state.js";

// ── Routing functions ─────────────────────────────────────────────────────────

/**
 * After ClassifierNode: route to the correct subgraph based on task type.
 * - qa / review  → QANode (retrieval + answer, no code changes)
 * - simpleFix    → CoderNode (direct, no planning needed)
 * - multiStep    → PlannerNode (plan → approve → code → execute → review)
 */
function routeAfterClassifier(
  state: AgentStateType
): "qa" | "planner" | "coder" {
  switch (state.taskType) {
    case "qa":
    case "review":
      return "qa";
    case "multiStep":
      return "planner";
    case "simpleFix":
    default:
      return "coder";
  }
}

/**
 * After ReviewerNode: either retry with CoderNode or finish with MemoryExtractor.
 * Max 3 retries — after that, we proceed even if not approved.
 */
function routeAfterReviewer(
  state: AgentStateType
): "coder" | "memoryExtractor" {
  if (state.reviewResult?.approved) return "memoryExtractor";
  if (state.retryCount >= 3) return "memoryExtractor";
  return "coder";
}

// ── Graph definition ──────────────────────────────────────────────────────────

const builder = new StateGraph(AgentStateAnnotation)
  // Nodes
  .addNode("classifier", classifierNode)
  .addNode("qa", qaNode)
  .addNode("planner", plannerNode)
  .addNode("coder", coderNode)
  .addNode("executor", executorNode)
  .addNode("reviewer", reviewerNode)
  .addNode("memoryExtractor", memoryExtractorNode)

  // Entry point
  .addEdge(START, "classifier")

  // Classifier → branch
  .addConditionalEdges("classifier", routeAfterClassifier, {
    qa: "qa",
    planner: "planner",
    coder: "coder",
  })

  // QA is terminal
  .addEdge("qa", END)

  // Multi-step path: planner → coder (after interrupt + approval)
  .addEdge("planner", "coder")

  // Shared execution path
  .addEdge("coder", "executor")
  .addEdge("executor", "reviewer")

  // Reviewer → retry or finish
  .addConditionalEdges("reviewer", routeAfterReviewer, {
    coder: "coder",
    memoryExtractor: "memoryExtractor",
  })

  // Memory extraction is the terminal node
  .addEdge("memoryExtractor", END);

/**
 * Compiled LangGraph agent.
 * Exported as `graph` so LangGraph Cloud (langgraph.json) can discover it.
 */
export const graph = builder.compile();
export type { AgentStateType };
