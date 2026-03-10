import type { QdrantClient } from "@qdrant/js-client-rest";
import { VECTOR_SIZE } from "./collections.js";

// ----------------------------------------
// Types
// ----------------------------------------

export interface SessionPayload {
  projectId: string;
  orgId: string;
  sessionId: string;
  summary: string;
  topics: string[];
  createdAt: string;
}

export interface SessionPoint {
  id: string;
  vector: number[];
  payload: SessionPayload;
}

export interface SearchedSession {
  id: string;
  score: number;
  payload: SessionPayload;
}

// ----------------------------------------
// Collection helpers
// ----------------------------------------

/** Session summary collection: one per project. */
export function sessionCollectionName(projectId: string): string {
  return `sessions_${projectId}`;
}

export async function ensureSessionCollection(
  client: QdrantClient,
  projectId: string
): Promise<void> {
  const name = sessionCollectionName(projectId);
  const { collections } = await client.getCollections();
  const exists = collections.some((c) => c.name === name);

  if (!exists) {
    await client.createCollection(name, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
  }
}

// ----------------------------------------
// Upsert
// ----------------------------------------

export async function upsertSessionSummary(
  client: QdrantClient,
  session: SessionPoint
): Promise<void> {
  const collection = sessionCollectionName(session.payload.projectId);

  await client.upsert(collection, {
    wait: true,
    points: [
      {
        id: session.id,
        vector: session.vector,
        payload: session.payload as unknown as Record<string, unknown>,
      },
    ],
  });
}

// ----------------------------------------
// Search — returns top-k session summaries relevant to a query
// ----------------------------------------

export async function searchSessionSummaries(
  client: QdrantClient,
  projectId: string,
  vector: number[],
  limit = 3,
  scoreThreshold?: number
): Promise<SearchedSession[]> {
  const collection = sessionCollectionName(projectId);

  let results;
  try {
    results = await client.search(collection, {
      vector,
      limit,
      score_threshold: scoreThreshold,
      filter: {
        must: [{ key: "projectId", match: { value: projectId } }],
      },
      with_payload: true,
    });
  } catch (error) {
    // Missing collection is expected for projects with no session summaries yet.
    if (isNotFoundError(error)) return [];
    throw error;
  }

  return results.map((r) => ({
    id: String(r.id),
    score: r.score,
    payload: r.payload as unknown as SessionPayload,
  }));
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as {
    status?: number;
    statusCode?: number;
    response?: { status?: number };
    message?: string;
  };
  if (err.status === 404 || err.statusCode === 404) return true;
  if (err.response?.status === 404) return true;
  if (typeof err.message === "string" && err.message.includes("Not Found")) return true;
  return false;
}
