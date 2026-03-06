import { QdrantClient } from "@qdrant/js-client-rest";

export function createQdrantClient(url: string, apiKey?: string): QdrantClient {
  return new QdrantClient({ url, apiKey });
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
