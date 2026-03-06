import type { QdrantClient } from "@qdrant/js-client-rest";
import { decisionCollectionName } from "./collections.js";

// ----------------------------------------
// Types
// ----------------------------------------

export interface DecisionPayload {
  projectId: string;
  orgId: string;
  goal: string;
  approach: string;
  tags: string[];
}

export interface DecisionPoint {
  id: string;        // UUID — matches decisionLog.id in Supabase
  vector: number[];  // embedding of goal + approach
  payload: DecisionPayload;
}

export interface SearchedDecision {
  id: string;
  score: number;
  payload: DecisionPayload;
}

// ----------------------------------------
// Upsert
// ----------------------------------------

export async function upsertDecision(
  client: QdrantClient,
  decision: DecisionPoint
): Promise<void> {
  const collection = decisionCollectionName(decision.payload.projectId);

  await client.upsert(collection, {
    wait: true,
    points: [
      {
        id: decision.id,
        vector: decision.vector,
        payload: decision.payload as Record<string, unknown>,
      },
    ],
  });
}

// ----------------------------------------
// Search — returns top-k decisions relevant to the current task
// ----------------------------------------

export async function searchDecisions(
  client: QdrantClient,
  projectId: string,
  vector: number[],
  limit = 3
): Promise<SearchedDecision[]> {
  const collection = decisionCollectionName(projectId);

  const results = await client.search(collection, {
    vector,
    limit,
    filter: {
      must: [{ key: "projectId", match: { value: projectId } }],
    },
    with_payload: true,
  });

  return results.map((r) => ({
    id: String(r.id),
    score: r.score,
    payload: r.payload as unknown as DecisionPayload,
  }));
}

// ----------------------------------------
// Delete — used when a decision is removed from the Memory Panel
// ----------------------------------------

export async function deleteDecision(
  client: QdrantClient,
  projectId: string,
  decisionId: string
): Promise<void> {
  const collection = decisionCollectionName(projectId);

  await client.delete(collection, {
    wait: true,
    points: [decisionId],
  });
}
