import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createSupabaseServiceRoleClient } from "@workspace/db";
import { createQdrantClient } from "@workspace/qdrant";
import { extractMemoryFromPR, generateSessionSummary } from "@workspace/memory";
import type { AgentStateType } from "../state.js";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

/**
 * memoryExtractNode — Claude Haiku 4.5 (async, non-blocking)
 *
 * Agent v2: Fires both memory extraction AND session summary generation
 * in the background. Returns immediately with memoryExtractionStatus: "running".
 *
 * - Memory extraction: conventions, decisions, file evolution (when diffs exist)
 * - Session summary: generates a summary of the session for long-term recall
 */
export async function memoryExtractorNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const hasDiffs = state.generatedDiffs.length > 0;
  const hasConversation = state.messages.length > 0;

  if (!hasDiffs && !hasConversation) {
    return { memoryExtractionStatus: "done" };
  }

  // Fire-and-forget — do not await
  void runExtraction(state, hasDiffs).catch((err: unknown) => {
    console.error("[MemoryExtractor] extraction failed:", err);
  });

  return { memoryExtractionStatus: "running" };
}

async function runExtraction(
  state: AgentStateType,
  hasDiffs: boolean
): Promise<void> {
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

  const tasks: Promise<void>[] = [];

  // Extract memory from diffs (conventions, decisions, file evolution)
  if (hasDiffs) {
    tasks.push(
      extractMemoryFromPR({
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
      })
    );
  }

  // Generate session summary for long-term recall (always, even for QA sessions)
  if (conversationHistory.length >= 2) {
    tasks.push(
      generateSessionSummary({
        supabase,
        anthropic,
        openai,
        qdrant,
        projectId: state.projectId,
        orgId: state.orgId,
        sessionId: state.sessionId,
        conversationHistory,
      })
    );
  }

  await Promise.all(tasks);
}
