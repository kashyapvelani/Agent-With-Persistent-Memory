import type { QdrantClient } from "@qdrant/js-client-rest";
import { codeCollectionName } from "./collections.js";

// ----------------------------------------
// Types
// ----------------------------------------

export interface CodeChunkPayload {
  filePath: string;
  language: string;
  nodeType: string;  // "function" | "class" | "interface" | "module" | etc.
  nodeName: string;
  content: string;
  repo: string;
  orgId: string;
  projectId: string;
}

export interface CodeChunkPoint {
  id: string;        // UUID — stable per chunk (hash of filePath+nodeName)
  vector: number[];
  payload: CodeChunkPayload;
}

export interface SearchedChunk {
  id: string;
  score: number;
  payload: CodeChunkPayload;
}

// ----------------------------------------
// Upsert
// ----------------------------------------

export async function upsertCodeChunks(
  client: QdrantClient,
  orgId: string,
  projectId: string,
  chunks: CodeChunkPoint[]
): Promise<void> {
  if (chunks.length === 0) return;

  const collection = codeCollectionName(orgId, projectId);

  await client.upsert(collection, {
    wait: true,
    points: chunks.map((c) => ({
      id: c.id,
      vector: c.vector,
      // Qdrant payload accepts generic JSON-like objects; bridge our typed payload explicitly.
      payload: c.payload as unknown as Record<string, unknown>,
    })),
  });
}

// ----------------------------------------
// Search
// ----------------------------------------

export async function searchCodeChunks(
  client: QdrantClient,
  orgId: string,
  projectId: string,
  vector: number[],
  limit = 8
): Promise<SearchedChunk[]> {
  const collection = codeCollectionName(orgId, projectId);

  const results = await client.search(collection, {
    vector,
    limit,
    filter: {
      must: [
        { key: "projectId", match: { value: projectId } },
        { key: "orgId",     match: { value: orgId } },
      ],
    },
    with_payload: true,
  });

  return results.map((r) => ({
    id: String(r.id),
    score: r.score,
    payload: r.payload as unknown as CodeChunkPayload,
  }));
}

// ----------------------------------------
// Delete — removes all chunks for a given file (used during re-indexing)
// ----------------------------------------

export async function deleteFileChunks(
  client: QdrantClient,
  orgId: string,
  projectId: string,
  filePath: string
): Promise<void> {
  const collection = codeCollectionName(orgId, projectId);

  await client.delete(collection, {
    wait: true,
    filter: {
      must: [
        { key: "projectId", match: { value: projectId } },
        { key: "filePath",  match: { value: filePath } },
      ],
    },
  });
}
