import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { AgentStateType } from "../state.js";
import type { TaskType } from "@workspace/types";

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a task classifier for an AI coding agent. Classify the user's coding request into exactly one of these types:

- qa: Code questions, explanations, documentation lookup, "how does X work", "where is Y defined"
- simpleFix: Single-file fix, small bug, minor refactor, rename, add a comment
- multiStep: New features, multi-file changes, complex bug fixes that require a plan, architectural changes
- review: "review this code", "check for bugs", "is this implementation correct"

Respond with JSON only — no explanation:
{ "taskType": "qa" | "simpleFix" | "multiStep" | "review", "affectedFiles": string[] }

affectedFiles: file paths the user explicitly mentions or clearly implies. Return [] if unclear.`;

/**
 * ClassifierNode — Claude Sonnet 4.6
 * Medium, Can able to think for classification to route to the correct subgraph.
 */
export async function classifierNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const model = new ChatAnthropic({
    model: MODEL,
    temperature: 0,
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const lastMessage = state.messages[state.messages.length - 1];
  const userText =
    typeof lastMessage?.content === "string" ? lastMessage.content : "";

  const response = await model.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(`Classify this request:\n${userText}`),
  ]);

  let taskType: TaskType = "qa";
  try {
    const text =
      typeof response.content === "string" ? response.content : "";
    // Strip markdown code fences if present
    const clean = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean) as { taskType: TaskType };
    taskType = parsed.taskType;
  } catch {
    taskType = "qa";
  }

  return { taskType };
}
