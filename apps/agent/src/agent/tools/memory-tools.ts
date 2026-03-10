import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type OpenAI from "openai";
import {
  createQdrantClient,
  searchDecisions,
  searchSessionSummaries,
  searchCodeChunks,
} from "@workspace/qdrant";

export interface MemoryToolsConfig {
  qdrant: ReturnType<typeof createQdrantClient>;
  openai: OpenAI;
  projectId: string;
  orgId: string;
}

/**
 * Builds memory-related tools that the agent uses to actively recall
 * past decisions, session context, and search indexed code.
 */
export function buildMemoryTools(config: MemoryToolsConfig) {
  const { qdrant, openai, projectId, orgId } = config;

  const recallMemory = tool(
    async ({ queries }) => {
      try {
        // Batch embed all queries in a single API call
        const embRes = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: queries,
        });

        const vectors = embRes.data.map((d) => d.embedding);

        // Search decisions and session summaries for each query in parallel
        const searchPromises = vectors.flatMap((vector) => [
          searchDecisions(qdrant, projectId, vector, 5),
          searchSessionSummaries(qdrant, projectId, vector, 3),
        ]);

        const results = await Promise.all(searchPromises);

        // Separate decisions and sessions, deduplicate by ID
        const seenIds = new Set<string>();
        const decisions: Array<{
          id: string;
          score: number;
          goal: string;
          approach: string;
          tags: string[];
        }> = [];
        const sessions: Array<{
          id: string;
          score: number;
          summary: string;
          topics: string[];
          createdAt: string;
        }> = [];

        for (let i = 0; i < results.length; i++) {
          const isDecision = i % 2 === 0;
          for (const r of results[i]!) {
            if (seenIds.has(r.id)) continue;
            seenIds.add(r.id);

            if (isDecision) {
              const payload = r.payload as {
                goal: string;
                approach: string;
                tags: string[];
              };
              decisions.push({
                id: r.id,
                score: r.score,
                goal: payload.goal,
                approach: payload.approach,
                tags: payload.tags ?? [],
              });
            } else {
              const payload = r.payload as {
                summary: string;
                topics: string[];
                createdAt: string;
              };
              sessions.push({
                id: r.id,
                score: r.score,
                summary: payload.summary,
                topics: payload.topics ?? [],
                createdAt: payload.createdAt ?? "",
              });
            }
          }
        }

        // Sort by score descending, take top results
        decisions.sort((a, b) => b.score - a.score);
        sessions.sort((a, b) => b.score - a.score);

        const topDecisions = decisions.slice(0, 5);
        const topSessions = sessions.slice(0, 3);

        if (topDecisions.length === 0 && topSessions.length === 0) {
          return "No relevant memories found for the given queries.";
        }

        const parts: string[] = ["## Recalled Memories\n"];

        if (topDecisions.length > 0) {
          parts.push("### Past Decisions");
          for (const d of topDecisions) {
            parts.push(
              `- **${d.goal}** (relevance: ${d.score.toFixed(2)})\n  Approach: ${d.approach}\n  Tags: ${d.tags.join(", ") || "none"}`
            );
          }
        }

        if (topSessions.length > 0) {
          parts.push("\n### Past Sessions");
          for (const s of topSessions) {
            parts.push(
              `- **${s.summary}** (relevance: ${s.score.toFixed(2)})\n  Topics: ${s.topics.join(", ")}\n  Date: ${s.createdAt || "unknown"}`
            );
          }
        }

        return parts.join("\n");
      } catch (err) {
        return `ERROR: Memory recall failed: ${String(err)}`;
      }
    },
    {
      name: "recall_memory",
      description:
        "Search the project's long-term memory for relevant past decisions and session context. " +
        "Provide 1-5 diverse search queries to find different angles of the same topic. " +
        "Use this when: the user references something from a past conversation, you need to understand " +
        "why a past decision was made, or you need project-specific patterns not in the always-on memory.",
      schema: z.object({
        queries: z
          .array(z.string())
          .min(1)
          .max(5)
          .describe(
            "1-5 search queries. Include: direct semantic match, broader contextual query, and related topic query."
          ),
      }),
    }
  );

  const searchCode = tool(
    async ({ query, limit }) => {
      try {
        const embRes = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: query,
        });
        const vector = embRes.data[0]!.embedding;

        const results = await searchCodeChunks(
          qdrant,
          orgId,
          projectId,
          vector,
          limit ?? 8
        );

        if (results.length === 0) {
          return "No matching code chunks found. The project may not be indexed yet, or try a different query.";
        }

        return results
          .map(
            (r) =>
              `### ${r.payload.filePath} (${r.payload.nodeType}: ${r.payload.nodeName}, score: ${r.score.toFixed(2)})\n\`\`\`${r.payload.language}\n${r.payload.content}\n\`\`\``
          )
          .join("\n\n");
      } catch (err) {
        return `ERROR: Code search failed: ${String(err)}`;
      }
    },
    {
      name: "search_code",
      description:
        "Semantic search across the project's indexed code chunks using embeddings. " +
        "Returns relevant functions, classes, and interfaces ranked by similarity. " +
        "Use this to find code by meaning (e.g., 'authentication middleware') rather " +
        "than exact text (use search_files for that).",
      schema: z.object({
        query: z
          .string()
          .describe("Natural language description of the code you're looking for"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Max results to return (default: 8)"),
      }),
    }
  );

  return [recallMemory, searchCode];
}
