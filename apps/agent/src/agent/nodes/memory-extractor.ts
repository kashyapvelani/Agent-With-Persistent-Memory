import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createSupabaseServiceRoleClient } from "@workspace/db";
import { createQdrantClient } from "@workspace/qdrant";
import { extractMemoryFromPR } from "@workspace/memory";
import type { AgentStateType } from "../state.js";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

/**
 * MemoryExtractorNode — Claude Haiku 4.5 (async, non-blocking)
 *
 * Fires extraction in the background and immediately returns
 * memoryExtractionStatus: "running". The actual work happens in a
 * detached promise. When complete, a "memoryUpdated" custom event
 * can be emitted via the LangGraph streaming API.
 *
 * Called after the user approves the final review.
 */
export async function memoryExtractorNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  // Nothing to extract if not approved or no diffs
  if (!state.reviewResult?.approved || state.generatedDiffs.length === 0) {
    return { memoryExtractionStatus: "done" };
  }

  // Fire-and-forget — do not await
  void runExtraction(state).catch((err: unknown) => {
    console.error("[MemoryExtractor] extraction failed:", err);
  });

  return { memoryExtractionStatus: "running" };
}

async function runExtraction(state: AgentStateType): Promise<void> {
  const supabase = createSupabaseServiceRoleClient({
    url: process.env.SUPABASE_URL!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const qdrant = createQdrantClient(
    process.env.QDRANT_URL!,
    process.env.QDRANT_API_KEY
  );

  const firstHuman = state.messages.find((m) => m._getType() === "human");
  const goal =
    typeof firstHuman?.content === "string" ? firstHuman.content : "";

  const conversationHistory = state.messages
    .filter((m) => HumanMessage.isInstance(m) || AIMessage.isInstance(m))
    .map((m) => ({
      role: (HumanMessage.isInstance(m) ? "human" : "ai") as "human" | "ai",
      content:
        typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));

  await extractMemoryFromPR({
    supabase,
    anthropic,
    openai,
    qdrant,
    projectId: state.projectId,
    orgId: state.orgId,
    sessionId: state.sessionId,
    goal,
    diffs: state.generatedDiffs,
    conversationHistory,
  });
}
