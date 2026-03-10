import type Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import type { TypedSupabaseClient } from "@workspace/db";
import type { QdrantClient } from "@qdrant/js-client-rest";
import { ensureSessionCollection, upsertSessionSummary } from "@workspace/qdrant";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

export interface GenerateSessionSummaryInput {
  supabase: TypedSupabaseClient;
  anthropic: Anthropic;
  openai: OpenAI;
  qdrant: QdrantClient;
  projectId: string;
  orgId: string;
  sessionId: string;
  conversationHistory: { role: "human" | "ai"; content: string }[];
}

/**
 * Generates a session summary after task completion. This is called
 * by the memoryExtractNode (fire-and-forget). The summary is stored
 * in both Supabase (for querying) and Qdrant (for semantic search).
 */
export async function generateSessionSummary(
  input: GenerateSessionSummaryInput
): Promise<void> {
  const {
    anthropic,
    openai,
    qdrant,
    supabase,
    projectId,
    orgId,
    sessionId,
    conversationHistory,
  } = input;

  if (conversationHistory.length === 0) return;

  const conversationText = conversationHistory
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  // Use Haiku to generate a concise summary with topics
  const response = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 512,
    system:
      "Summarize this coding session. Return JSON only: " +
      '{ "summary": string (2-3 sentences capturing what was discussed/built/decided), ' +
      '"topics": string[] (3-8 topic tags, e.g. ["authentication", "database schema", "GraphQL migration"]) }',
    messages: [
      { role: "user", content: `Session conversation:\n${conversationText}` },
    ],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "{}";
  let parsed: { summary?: string; topics?: string[] };
  try {
    parsed = JSON.parse(text) as { summary?: string; topics?: string[] };
  } catch {
    return;
  }

  const summary = parsed.summary ?? "";
  const topics = parsed.topics ?? [];
  if (!summary) return;

  // Embed the summary for semantic search
  const embRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: summary,
  });
  const embedding = embRes.data[0]!.embedding;

  const summaryId = crypto.randomUUID();

  // Store in Supabase
  await supabase.from("sessionSummaries").insert({
    id: summaryId,
    projectid: projectId,
    orgid: orgId,
    sessionid: sessionId,
    summary,
    topics,
    embedding,
  });

  // Store in Qdrant for semantic search
  await ensureSessionCollection(qdrant, projectId);
  await upsertSessionSummary(qdrant, {
    id: summaryId,
    vector: embedding,
    payload: {
      projectId,
      orgId,
      sessionId,
      summary,
      topics,
      createdAt: new Date().toISOString(),
    },
  });
}
