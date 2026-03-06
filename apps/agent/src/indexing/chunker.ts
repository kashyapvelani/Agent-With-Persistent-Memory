import { v5 as uuidv5 } from "uuid";
import { parseFile, type RawChunk } from "./parser.js";
import { detectLanguage } from "./filter.js";
import type { CodeChunkPoint } from "@workspace/qdrant";

// UUID v5 namespace (URL namespace — stable across runs)
const CHUNK_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

// Max characters fed into the embedding model.
// text-embedding-3-small: 8191 token limit ≈ ~24k chars, but we cap lower for cost.
const MAX_CONTENT_CHARS = 8_000;

function stableChunkId(projectId: string, filePath: string, nodeType: string, nodeName: string): string {
  return uuidv5(`${projectId}:${filePath}:${nodeType}:${nodeName}`, CHUNK_NAMESPACE);
}

function buildEmbedText(filePath: string, chunk: RawChunk): string {
  // Prefix gives the embedding model semantic context about what this chunk is
  return `// file: ${filePath}\n// ${chunk.nodeType}: ${chunk.nodeName}\n\n${chunk.content}`.slice(
    0,
    MAX_CONTENT_CHARS
  );
}

export interface EmbeddableChunk {
  id: string;
  embedText: string;       // text to embed
  payload: CodeChunkPoint["payload"];
}

export function chunkFile(
  filePath: string,
  content: string,
  meta: { repo: string; orgId: string; projectId: string }
): EmbeddableChunk[] {
  const language = detectLanguage(filePath);
  const rawChunks = parseFile(filePath, content);

  return rawChunks.map((raw) => ({
    id: stableChunkId(meta.projectId, filePath, raw.nodeType, raw.nodeName),
    embedText: buildEmbedText(filePath, raw),
    payload: {
      filePath,
      language,
      nodeType: raw.nodeType,
      nodeName: raw.nodeName,
      content: raw.content.slice(0, MAX_CONTENT_CHARS),
      repo: meta.repo,
      orgId: meta.orgId,
      projectId: meta.projectId,
    },
  }));
}
