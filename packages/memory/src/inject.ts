import type { TypedSupabaseClient } from "@workspace/db";
import type { QdrantClient } from "@qdrant/js-client-rest";
import type OpenAI from "openai";
import { searchDecisions } from "@workspace/qdrant";

/**
 * Builds the memory context block injected into every PlannerNode / CoderNode
 * system prompt. Pulls conventions + architecture from Supabase and searches
 * the decision log semantically via Qdrant.
 */
export async function buildMemoryContext(
  supabase: TypedSupabaseClient,
  qdrant: QdrantClient,
  openai: OpenAI,
  projectId: string,
  taskDescription: string
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

  // Embed the current task to find semantically relevant past decisions
  const embRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: taskDescription,
  });
  const vector = embRes.data[0]!.embedding;
  const decisions = await searchDecisions(qdrant, projectId, vector, 3);

  // ── Conventions block ────────────────────────────────────────────────────
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

  // ── Architecture block ───────────────────────────────────────────────────
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

  // ── Decision log block ───────────────────────────────────────────────────
  const decisionsBlock =
    decisions.length > 0
      ? `### Relevant Past Decisions
${decisions
  .map(
    (d, i) =>
      `${i + 1}. Goal: ${d.payload.goal}\n   Approach: ${d.payload.approach}`
  )
  .join("\n")}`
      : "";

  if (!conventionsBlock && !architectureBlock && !decisionsBlock) return "";

  return `## Project Intelligence (follow strictly)

${conventionsBlock}

${architectureBlock}

${decisionsBlock}`.trim();
}
