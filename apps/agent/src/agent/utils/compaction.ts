import { ChatAnthropic } from "@langchain/anthropic";
import {
  SystemMessage,
  HumanMessage,
} from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

/**
 * Rough token estimation — ~4 chars per token on average.
 * Good enough for budget management without needing a tokenizer.
 */
export function estimateTokens(messages: BaseMessage[]): number {
  let chars = 0;
  for (const m of messages) {
    const content = typeof m.content === "string"
      ? m.content
      : JSON.stringify(m.content);
    chars += content.length;
  }
  return Math.ceil(chars / 4);
}

/**
 * Compacts conversation history when it exceeds the token budget.
 * Takes the oldest 60% of messages, summarizes them with Haiku,
 * and replaces them with a single SystemMessage summary.
 * Keeps the recent 40% intact.
 *
 * Returns null if no compaction needed.
 */
export async function compactIfNeeded(
  messages: BaseMessage[],
  threshold = 80_000
): Promise<BaseMessage[] | null> {
  const tokenCount = estimateTokens(messages);
  if (tokenCount < threshold) return null;

  const splitPoint = Math.floor(messages.length * 0.6);
  if (splitPoint < 2) return null; // Too few messages to compact

  const oldMessages = messages.slice(0, splitPoint);
  const recentMessages = messages.slice(splitPoint);

  // Format old messages for summarization
  const formatted = oldMessages
    .map((m) => {
      const content =
        typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      const role = m._getType();
      // Truncate very long tool outputs for summarization
      const truncated =
        content.length > 2000 ? content.slice(0, 1500) + "... [truncated]" : content;
      return `[${role}]: ${truncated}`;
    })
    .join("\n\n");

  const haiku = new ChatAnthropic({
    model: HAIKU_MODEL,
    temperature: 0,
    maxTokens: 1024,
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const summaryResponse = await haiku.invoke([
    new SystemMessage(
      "Summarize this conversation history concisely. Preserve ALL of the following:\n" +
        "- Decisions made and their reasoning\n" +
        "- Files read, created, or modified\n" +
        "- Errors encountered and how they were resolved\n" +
        "- Outstanding tasks or next steps\n" +
        "- User preferences expressed\n" +
        "Be concise but complete. Use bullet points."
    ),
    new HumanMessage(formatted),
  ]);

  const summaryText =
    typeof summaryResponse.content === "string"
      ? summaryResponse.content
      : JSON.stringify(summaryResponse.content);

  return [
    new SystemMessage(
      `## Conversation History Summary (auto-compacted)\n\n${summaryText}`
    ),
    ...recentMessages,
  ];
}
