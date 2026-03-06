import OpenAI from "openai";
import type { EmbeddableChunk } from "./chunker.js";
import type { CodeChunkPoint } from "@workspace/qdrant";

const BATCH_SIZE = 100; // OpenAI limit per embeddings request
const MODEL = "text-embedding-3-small";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const client = getClient();
  const vectors: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await client.embeddings.create({ model: MODEL, input: batch });
    // Response items are ordered to match input
    vectors.push(...response.data.map((d) => d.embedding));
  }

  return vectors;
}

/**
 * Embeds a batch of chunks and returns CodeChunkPoints ready for Qdrant upsert.
 */
export async function embedChunks(chunks: EmbeddableChunk[]): Promise<CodeChunkPoint[]> {
  if (chunks.length === 0) return [];

  const texts = chunks.map((c) => c.embedText);
  const vectors = await embedTexts(texts);

  return chunks.map((chunk, i) => ({
    id: chunk.id,
    vector: vectors[i]!,
    payload: chunk.payload,
  }));
}

/**
 * Embeds a single text string — used for decision log and semantic search queries.
 */
export async function embedText(text: string): Promise<number[]> {
  const vectors = await embedTexts([text]);
  return vectors[0]!;
}
