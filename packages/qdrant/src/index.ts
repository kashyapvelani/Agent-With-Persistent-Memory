import { QdrantClient } from "@qdrant/js-client-rest";

export function createQdrantClient(url: string, apiKey?: string): QdrantClient {
  // Parse the URL to extract port — Railway and other cloud hosts use HTTPS (443),
  // but QdrantClient defaults to 6333 if no port is specified.
  const parsed = new URL(url);
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 6333;

  return new QdrantClient({
    url: `${parsed.protocol}//${parsed.hostname}`,
    port,
    apiKey,
    checkCompatibility: false,
  });
}

export {
  VECTOR_SIZE,
  codeCollectionName,
  decisionCollectionName,
  ensureCodeCollection,
  ensureDecisionCollection,
  deleteCodeCollection,
} from "./collections.js";

export {
  upsertCodeChunks,
  searchCodeChunks,
  deleteFileChunks,
  type CodeChunkPayload,
  type CodeChunkPoint,
  type SearchedChunk,
} from "./chunks.js";

export {
  upsertDecision,
  searchDecisions,
  deleteDecision,
  type DecisionPayload,
  type DecisionPoint,
  type SearchedDecision,
} from "./decisions.js";

export {
  sessionCollectionName,
  ensureSessionCollection,
  upsertSessionSummary,
  searchSessionSummaries,
  type SessionPayload,
  type SessionPoint,
  type SearchedSession,
} from "./sessions.js";
