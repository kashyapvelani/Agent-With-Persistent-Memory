import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentStateAnnotation } from "./state.js";
import { initNode } from "./nodes/init.js";
import { agentLoopNode } from "./nodes/agent-loop.js";
import { memoryExtractorNode } from "./nodes/memory-extractor.js";
import type { AgentStateType } from "./state.js";

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_ITERATIONS = 50;

// ── Routing ──────────────────────────────────────────────────────────────────

/**
 * After each agentLoop iteration, decide whether to continue looping
 * or exit to memory extraction.
 */
function shouldContinue(state: AgentStateType): "agentLoop" | "memoryExtract" {
  if (state.finished) return "memoryExtract";
  if (state.iterationCount >= MAX_ITERATIONS) return "memoryExtract";
  return "agentLoop";
}

const builder = new StateGraph(AgentStateAnnotation)
  // Nodes
  .addNode("init", initNode)
  .addNode("agentLoop", agentLoopNode)
  .addNode("memoryExtract", memoryExtractorNode)

  // Edges
  .addEdge(START, "init")
  .addEdge("init", "agentLoop")
  .addConditionalEdges("agentLoop", shouldContinue, {
    agentLoop: "agentLoop",
    memoryExtract: "memoryExtract",
  })
  .addEdge("memoryExtract", END);

/**
 * Compiled LangGraph agent.
 * Exported as `graph` so LangGraph Cloud (langgraph.json) can discover it.
 */
export const graph = builder.compile();
export type { AgentStateType };
