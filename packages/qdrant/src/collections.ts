import type { QdrantClient } from "@qdrant/js-client-rest";

// Vector dimension matches text-embedding-3-small
export const VECTOR_SIZE = 1536;

// ----------------------------------------
// Collection name helpers
// ----------------------------------------

/** Code chunk collection: one per org+project. */
export function codeCollectionName(orgId: string, projectId: string): string {
  return `${orgId}_${projectId}`;
}

/** Decision collection: one per project, shared across org. */
export function decisionCollectionName(projectId: string): string {
  return `decisions_${projectId}`;
}

// ----------------------------------------
// Ensure collections exist (idempotent)
// ----------------------------------------

export async function ensureCodeCollection(
  client: QdrantClient,
  orgId: string,
  projectId: string
): Promise<void> {
  const name = codeCollectionName(orgId, projectId);
  await ensureCollection(client, name);
}

export async function ensureDecisionCollection(
  client: QdrantClient,
  projectId: string
): Promise<void> {
  const name = decisionCollectionName(projectId);
  await ensureCollection(client, name);
}

async function ensureCollection(client: QdrantClient, name: string): Promise<void> {
  const { collections } = await client.getCollections();
  const exists = collections.some((c) => c.name === name);

  if (!exists) {
    await client.createCollection(name, {
      vectors: {
        size: VECTOR_SIZE,
        distance: "Cosine",
      },
    });
  }
}

export async function deleteCodeCollection(
  client: QdrantClient,
  orgId: string,
  projectId: string
): Promise<void> {
  const name = codeCollectionName(orgId, projectId);
  await client.deleteCollection(name);
}
