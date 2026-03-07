import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import OpenAI from "openai";
import { createQdrantClient, searchCodeChunks } from "@workspace/qdrant";
import { createSupabaseServiceRoleClient } from "@workspace/db";
import type { AgentStateType } from "../state.js";
import type { CodeChunk } from "@workspace/types";

const MODEL = "claude-haiku-4-5-20251001";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
function getQdrant() {
  return createQdrantClient(process.env.QDRANT_URL!, process.env.QDRANT_API_KEY);
}

/**
 * QANode — Claude Haiku 4.5
 * Retrieves top-5 code chunks from Qdrant, answers with citations.
 * Surfaces instability warnings for high-churn files.
 * (Cohere rerank will be added in Phase 5 once the core flow is working.)
 */
export async function qaNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const lastMessage = state.messages[state.messages.length - 1];
  const query =
    typeof lastMessage?.content === "string" ? lastMessage.content : "";

  // 1. Embed the query
  const openai = getOpenAI();
  const embRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  const queryVector = embRes.data[0]!.embedding;

  // 2. Search Qdrant — top 5 chunks filtered by project
  const qdrant = getQdrant();
  const searchResults = await searchCodeChunks(
    qdrant,
    state.orgId,
    state.projectId,
    queryVector,
    5
  );

  const topChunks: CodeChunk[] = searchResults.map((r) => ({
    filePath: r.payload.filePath,
    language: r.payload.language,
    nodeType: r.payload.nodeType,
    nodeName: r.payload.nodeName,
    content: r.payload.content,
    score: r.score,
  }));

  // 3. Check instability warnings for relevant files
  const supabase = createSupabaseServiceRoleClient({
    url: process.env.SUPABASE_URL!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  });
  const involvedFiles = topChunks.map((c) => c.filePath);
  let instabilityWarnings: string | null = null;
  if (involvedFiles.length > 0) {
    const { data: unstableFiles } = await supabase
      .from("fileEvolution")
      .select("filePath, instabilityScore, changeCount")
      .eq("projectId", state.projectId)
      .in("filePath", involvedFiles)
      .gt("instabilityScore", 0.7);

    if (unstableFiles && unstableFiles.length > 0) {
      instabilityWarnings = unstableFiles
        .map(
          (f) =>
            `⚠️ \`${f.filePath}\` has been modified in ${f.changeCount} recent tasks (instability score: ${(f.instabilityScore * 100).toFixed(0)}%). Changes here may have wider impact.`
        )
        .join("\n");
    }
  }

  // 4. Build context block
  const contextBlock =
    topChunks.length > 0
      ? topChunks
          .map(
            (c, i) =>
              `[${i + 1}] ${c.filePath} — \`${c.nodeName}\`\n\`\`\`${c.language}\n${c.content}\n\`\`\``
          )
          .join("\n\n")
      : "No relevant code found in the indexed codebase.";

  // 5. Generate answer
  const model = new ChatAnthropic({
    model: MODEL,
    temperature: 0.2,
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const systemPrompt =
    "You are a coding assistant for this project. Answer questions using the provided code chunks. " +
    "Always cite sources using [N] notation referencing the file path. Be concise and precise." +
    (instabilityWarnings
      ? `\n\nInstability warnings to surface:\n${instabilityWarnings}`
      : "");

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`Code context:\n${contextBlock}\n\nQuestion: ${query}`),
  ]);

  const answerText =
    typeof response.content === "string" ? response.content : "";

  return {
    retrievedChunks: topChunks,
    messages: [new AIMessage(answerText)],
  };
}
