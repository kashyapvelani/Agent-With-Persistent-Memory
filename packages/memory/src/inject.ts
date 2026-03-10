import type { TypedSupabaseClient } from "@workspace/db";
import type { QdrantClient } from "@qdrant/js-client-rest";
import type OpenAI from "openai";
import { searchDecisions, searchSessionSummaries } from "@workspace/qdrant";

/**
 * Builds the always-on memory block (~2-3K tokens) injected into every
 * system prompt. Pulls conventions + architecture from Supabase.
 *
 * Unlike v1's buildMemoryContext, this does NOT search decisions — that
 * is handled by the recall_memory tool in the agent loop.
 */
export async function buildAlwaysOnMemory(
  supabase: TypedSupabaseClient,
  projectId: string
): Promise<string> {
  const [conventionsRes, archRes] = await Promise.all([
    supabase
      .from("projectConventions")
      .select("conventions")
      .eq("projectId", projectId)
      .maybeSingle(),
    supabase
      .from("projectArchitecture")
      .select("architecture")
      .eq("projectId", projectId)
      .maybeSingle(),
  ]);

  const conventions = conventionsRes.data?.conventions;
  const architecture = archRes.data?.architecture;

  // ── Conventions block ──────────────────────────────────────────────────
  const conventionsBlock = conventions
    ? `### Coding Conventions
- Naming style: ${conventions.namingStyle || "not specified"}
- API pattern: ${conventions.apiPattern || "not specified"}
- Error handling: ${conventions.errorPattern || "not specified"}
- Testing framework: ${conventions.testingFramework || "not specified"}
- Logging: ${conventions.logging || "not specified"}
- Preferred libraries: ${conventions.preferredLibraries?.join(", ") || "none"}
- File structure: ${conventions.fileStructure || "not specified"}`
    : "";

  // ── Architecture block ─────────────────────────────────────────────────
  const architectureBlock = architecture
    ? `### Architecture Rules
Layers: ${architecture.layers?.join(" → ") || "not specified"}
Rules:
${architecture.rules?.map((r: string) => `- ${r}`).join("\n") || "none"}
Module summaries:
${
  Object.entries(architecture.moduleSummaries ?? {})
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n") || "none"
}
Service relationships:
${architecture.serviceRelationships?.map((r: string) => `- ${r}`).join("\n") || "none"}`
    : "";

  if (!conventionsBlock && !architectureBlock) return "";

  return `## Project Intelligence (follow strictly)

${conventionsBlock}

${architectureBlock}`.trim();
}

/**
 * Proactive memory surfacing — runs on each user message in initNode.
 * Embeds the user's message and searches decisions + session summaries
 * with a high threshold (>0.85) to find only highly relevant matches.
 * Returns a formatted block or empty string if nothing found.
 *
 * This is NOT an LLM call — only an embedding + vector search.
 */
export async function surfaceRelevantMemories(
  qdrant: QdrantClient,
  openai: OpenAI,
  projectId: string,
  userMessage: string
): Promise<string> {
  if (!userMessage.trim()) return "";

  const embRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: userMessage,
  });
  const vector = embRes.data[0]!.embedding;

  // Search both decisions and session summaries with high confidence threshold
  const [decisions, sessions] = await Promise.all([
    searchDecisions(qdrant, projectId, vector, 3).then((results) =>
      results.filter((r) => r.score > 0.85)
    ),
    searchSessionSummaries(qdrant, projectId, vector, 2, 0.85),
  ]);

  if (decisions.length === 0 && sessions.length === 0) return "";

  const parts: string[] = [];

  if (decisions.length > 0) {
    parts.push(
      decisions
        .map(
          (d) =>
            `- **Decision**: ${d.payload.goal} → ${d.payload.approach} (relevance: ${d.score.toFixed(2)})`
        )
        .join("\n")
    );
  }

  if (sessions.length > 0) {
    parts.push(
      sessions
        .map(
          (s) =>
            `- **Past session**: ${s.payload.summary} (topics: ${s.payload.topics.join(", ")}, relevance: ${s.score.toFixed(2)})`
        )
        .join("\n")
    );
  }

  return `## Relevant Context from Project History\n${parts.join("\n")}`;
}

/**
 * @deprecated Use buildAlwaysOnMemory for agent v2. This is kept for backward
 * compatibility with any v1 code that may still reference the old function.
 */
export async function buildMemoryContext(
  supabase: TypedSupabaseClient,
  _qdrant: QdrantClient,
  _openai: OpenAI,
  projectId: string,
  _taskDescription: string
): Promise<string> {
  return buildAlwaysOnMemory(supabase, projectId);
}
