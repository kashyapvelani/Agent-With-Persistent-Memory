import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { interrupt } from "@langchain/langgraph";
import OpenAI from "openai";
import { createQdrantClient, searchCodeChunks } from "@workspace/qdrant";
import { createSupabaseServiceRoleClient } from "@workspace/db";
import { buildMemoryContext } from "@workspace/memory";
import type { AgentStateType } from "../state.js";
import type { PlanStep, CodeChunk } from "@workspace/types";
import { ChatAnthropic } from "@langchain/anthropic";

// Update model ID when Claude Opus 4.6 Thinking becomes available
const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a senior software engineer creating a precise implementation plan.
Given the user request, relevant code context, and project memory, produce a step-by-step plan.

Rules:
- Each step modifies exactly one file
- Steps must be ordered correctly (dependencies first)
- Be specific: describe exactly what to add/change/remove
- Never include "setup" or "boilerplate" steps that the user didn't ask for

Output JSON only:
{
  "steps": [
    { "step": string, "file": string, "action": "create" | "edit" | "delete", "description": string }
  ]
}`;

/**
 * PlannerNode — Sonnet 4.6 (upgrade to Opus 4.6 thinking if needed)
 * Generates a step-by-step plan, then interrupts for human approval.
 * After resume: uses edited plan if user modified it, otherwise original.
 */
export async function plannerNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const lastMessage = state.messages[state.messages.length - 1];
  const userRequest =
    typeof lastMessage?.content === "string" ? lastMessage.content : "";

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const qdrant = createQdrantClient(
    process.env.QDRANT_URL!,
    process.env.QDRANT_API_KEY
  );
  const supabase = createSupabaseServiceRoleClient({
    url: process.env.SUPABASE_URL!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  });

  // Build memory context (conventions + arch rules + relevant past decisions)
  const memoryContext = await buildMemoryContext(
    supabase,
    qdrant,
    openai,
    state.projectId,
    userRequest
  );

  // Retrieve relevant code chunks for context
  const embRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: userRequest,
  });
  const queryVector = embRes.data[0]!.embedding;
  const searchResults = await searchCodeChunks(
    qdrant,
    state.orgId,
    state.projectId,
    queryVector,
    6
  );

  const contextBlock = searchResults
    .map((c) => `// ${c.payload.filePath} — ${c.payload.nodeName}\n${c.payload.content}`)
    .join("\n\n---\n\n");

  // Generate the plan
  const model = new ChatAnthropic({
    model: MODEL,
    temperature: 0.2,
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const response = await model.invoke([
    new SystemMessage(
      memoryContext ? `${SYSTEM_PROMPT}\n\n${memoryContext}` : SYSTEM_PROMPT
    ),
    new HumanMessage(
      `Relevant code:\n${contextBlock || "No indexed code found."}\n\nTask: ${userRequest}`
    ),
  ]);

  let plan: PlanStep[] = [];
  try {
    const text =
      typeof response.content === "string" ? response.content : "";
    const clean = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean) as { steps: Omit<PlanStep, "status">[] };
    plan = parsed.steps.map((s) => ({ ...s, status: "pending" as const }));
  } catch {
    plan = [];
  }

  // ── Human-in-the-loop: pause and send plan to user for approval ──────────
  // The frontend receives { type: "plan_approval", plan } and renders PlanTimeline.
  // When the user approves or edits, they resume the graph with:
  //   { action: "approve" } or { action: "edit", editedPlan: PlanStep[] }
  const humanFeedback = interrupt({
    type: "plan_approval",
    plan,
  }) as { action: "approve" | "edit"; editedPlan?: PlanStep[] };

  const finalPlan =
    humanFeedback.action === "edit" && humanFeedback.editedPlan
      ? humanFeedback.editedPlan
      : plan;

  const retrievedChunks: CodeChunk[] = searchResults.map((c) => ({
    filePath: c.payload.filePath,
    language: c.payload.language,
    nodeType: c.payload.nodeType,
    nodeName: c.payload.nodeName,
    content: c.payload.content,
    score: c.score,
  }));

  return {
    plan: finalPlan,
    currentStepIndex: 0,
    memoryContext,
    retrievedChunks,
    messages: [
      new AIMessage(
        JSON.stringify({ type: "plan_approved", plan: finalPlan })
      ),
    ],
  };
}
