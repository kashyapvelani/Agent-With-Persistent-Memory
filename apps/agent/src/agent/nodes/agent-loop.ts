import { ChatAnthropic } from "@langchain/anthropic";
import {
  AIMessage,
  RemoveMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import OpenAI from "openai";
import { Sandbox } from "e2b";
import { createQdrantClient } from "@workspace/qdrant";
import { buildReadOnlyTools, buildWriteTools } from "../../sandbox/tools.js";
import {
  buildControlFlowTools,
  type ControlToolsContext,
} from "../tools/control-tools.js";
import { buildMemoryTools } from "../tools/memory-tools.js";
import { compactIfNeeded } from "../utils/compaction.js";
import type { AgentStateType } from "../state.js";

const MODEL = "claude-sonnet-4-6";
const MAX_ITERATIONS = 50;
const MAX_SAME_TOOL_CALLS = 3; // Max times the same tool can be called with similar args

// ── System prompt ────────────────────────────────────────────────────────────

const BASE_SYSTEM_PROMPT = `You are ADE, an expert AI coding agent with direct access to a project repository via an E2B sandbox. You gather context, take action, verify results, and iterate until the task is done.

## Your Approach
1. **Understand**: Read the user's request carefully. Recall relevant memories if the task references past work.
2. **Explore**: Read files, search code, list directories to understand the current state.
3. **Plan** (if complex): For multi-file changes, create a plan with create_plan. In plan mode, call request_plan_approval.
4. **Execute**: Make changes with edit_file (preferred) or write_file. One logical change at a time.
5. **Verify**: Run tests, type-check, or read the changed file to confirm correctness.
6. **Iterate**: If something breaks, fix it. Keep going until the task is fully done.
7. **Finish**: Call finish() when done. For code changes, call request_review_approval first.

## When to Use recall_memory
- When the user references something from a past conversation or decision
- When you need to understand why a past decision was made
- When you're unsure about a convention or pattern in this project
- Generate diverse queries: direct match, contextual, related topics

## When to Call request_review_approval
- After making code changes that affect functionality
- Before calling finish() if diffs exist
- NOT needed for: QA answers, explanations, plan-only work

## When to Just Answer Directly
- Simple greetings, clarifications, or follow-up questions
- Questions you can answer from the always-on project memory context
- If no tools are needed, just respond — don't call finish() for conversational replies

## CRITICAL: Tool Repetition Rules
- **NEVER call the same tool more than 3 times with similar arguments.** If a tool returns unhelpful results, do NOT retry with minor variations — try a completely different tool or approach instead.
- If search_code returns irrelevant results, switch to search_files (grep) or list_directory + read_file to explore manually.
- If search_files returns no results, try glob to find relevant files first, then read_file.
- If you cannot find what you need after 2-3 attempts, **stop and ask the user** for more details or clarification rather than repeating failed searches.
- Prefer concrete tools (read_file, list_directory) over semantic search (search_code) when you know approximate file paths.

## Rules
- Follow all project conventions in the Project Intelligence block strictly
- Never make changes beyond what the task requires
- Read a file before editing it — always
- Use edit_file for targeted edits, write_file for new files
- Run tests after making changes to verify correctness
- If you break something, fix it before finishing`;

// ── Repetition detection ──────────────────────────────────────────────────────

interface ToolCallRecord {
  name: string;
  argsKey: string;
}

/**
 * Scans recent messages for repeated tool calls with similar arguments.
 * Returns a warning string to inject into tool output if repetition is detected,
 * or null if no repetition found.
 */
function detectToolRepetition(
  messages: BaseMessage[],
  currentToolName: string,
  currentArgs: Record<string, unknown>
): string | null {
  const currentArgsKey = normalizeArgsKey(currentToolName, currentArgs);

  // Count how many times this tool was called with similar args in recent messages
  let count = 0;
  // Scan last 30 messages (15 iterations worth of AI + tool message pairs)
  const recentMessages = messages.slice(-30);

  for (const msg of recentMessages) {
    if (msg._getType() !== "ai") continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolCalls = (msg as any).tool_calls as Array<{
      name: string;
      args: Record<string, unknown>;
    }> | undefined;
    if (!toolCalls) continue;

    for (const tc of toolCalls) {
      if (tc.name === currentToolName) {
        const prevKey = normalizeArgsKey(tc.name, tc.args);
        if (isSimilarArgs(currentArgsKey, prevKey)) {
          count++;
        }
      }
    }
  }

  if (count >= MAX_SAME_TOOL_CALLS) {
    return (
      `\n\n⚠️ REPETITION WARNING: You have called "${currentToolName}" ${count + 1} times with similar arguments. ` +
      `STOP calling this tool with similar parameters. Try a completely different approach:\n` +
      `- Use a different tool (e.g., list_directory, read_file, glob instead of search_code/search_files)\n` +
      `- Ask the user for more details if you can't find what you need\n` +
      `- Work with the information you already have`
    );
  }

  return null;
}

/**
 * Normalize tool args into a comparable string key.
 * For search-type tools, extract the core query/pattern.
 */
function normalizeArgsKey(toolName: string, args: Record<string, unknown>): string {
  if (toolName === "search_code") {
    return `search_code:${String(args.query ?? "").toLowerCase().trim()}`;
  }
  if (toolName === "search_files") {
    return `search_files:${String(args.pattern ?? "").toLowerCase().trim()}:${String(args.path ?? "")}`;
  }
  if (toolName === "recall_memory") {
    const queries = Array.isArray(args.queries) ? args.queries.sort().join("|") : "";
    return `recall_memory:${queries.toLowerCase()}`;
  }
  // For other tools, use name + sorted args JSON
  return `${toolName}:${JSON.stringify(args, Object.keys(args).sort())}`;
}

/**
 * Check if two arg keys are "similar enough" to count as repetition.
 * Uses simple heuristics: exact match or high overlap for search queries.
 */
function isSimilarArgs(a: string, b: string): boolean {
  if (a === b) return true;

  // For search tools, check if the queries share >60% of words
  const [toolA, queryA] = a.split(":", 2);
  const [toolB, queryB] = b.split(":", 2);
  if (toolA !== toolB) return false;

  if (toolA === "search_code" || toolA === "search_files") {
    const wordsA = new Set((queryA ?? "").split(/\s+/).filter(Boolean));
    const wordsB = new Set((queryB ?? "").split(/\s+/).filter(Boolean));
    if (wordsA.size === 0 || wordsB.size === 0) return false;
    const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
    const similarity = intersection / Math.max(wordsA.size, wordsB.size);
    return similarity > 0.6;
  }

  return false;
}

/**
 * agentLoopNode — THE core node. Single Claude Sonnet call per iteration.
 *
 * Each pass processes ONE model response and ALL its tool calls.
 * The graph's shouldContinue conditional edge re-enters this node
 * if not finished, creating the agentic loop.
 *
 * This design lets LangGraph checkpoint between iterations for:
 * - Resume after server restart
 * - Interrupt/resume works naturally
 * - Stream progress to frontend per iteration
 */
export async function agentLoopNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  // ── Compact conversation if needed ────────────────────────────────────────
  // If compaction triggers, we use the compacted version for the LLM call
  // but use RemoveMessage ops to remove old messages from state properly.
  let messagesForLLM = state.messages;
  let compactionOps: BaseMessage[] | null = null;
  const compacted = await compactIfNeeded(state.messages);
  if (compacted) {
    messagesForLLM = compacted;
    // Build removal ops: remove old messages that were summarized,
    // then add the summary message
    const splitPoint = Math.floor(state.messages.length * 0.6);
    const removals = state.messages.slice(0, splitPoint).map(
      (m) => new RemoveMessage({ id: m.id ?? "" })
    );
    // The first message in compacted is the summary SystemMessage
    compactionOps = [...removals, compacted[0]!];
  }

  // ── Get sandbox (may be null for QA-only tasks) ────────────────────────────
  let sandbox: Sandbox | null = null;
  if (state.sandboxId) {
    try {
      sandbox = await Sandbox.connect(state.sandboxId);
    } catch {
      console.warn("[agentLoop] Could not connect to sandbox:", state.sandboxId);
    }
  }

  // ── Build shared context for control tools ─────────────────────────────────
  const controlCtx: ControlToolsContext = {
    sandbox,
    plan: state.plan ? [...state.plan] : null,
    generatedDiffs: [...state.generatedDiffs],
    finished: false,
    mode: state.mode,
  };

  // ── Build tool set based on mode ───────────────────────────────────────────
  const controlTools = buildControlFlowTools(controlCtx);

  const qdrant = createQdrantClient(
    process.env.QDRANT_URL!,
    process.env.QDRANT_API_KEY
  );
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const memoryTools = buildMemoryTools({
    qdrant,
    openai,
    projectId: state.projectId,
    orgId: state.orgId,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sandboxTools: any[] = [];
  if (sandbox) {
    const isPlanModePreApproval = state.mode === "plan" && !state.plan;
    if (isPlanModePreApproval) {
      sandboxTools = buildReadOnlyTools(sandbox);
    } else {
      sandboxTools = [
        ...buildReadOnlyTools(sandbox),
        ...buildWriteTools(sandbox),
      ];
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allTools: any[] = [...sandboxTools, ...memoryTools, ...controlTools];

  // ── Build system prompt with prompt caching ──────────────────────────────
  // Anthropic prompt caching: mark stable content blocks with cache_control
  // so they're cached across iterations (saves cost + latency).
  // The system message uses content blocks with cache_control on the last block.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const systemBlocks: any[] = [];

  // Block 1: Base system prompt (stable, always cached)
  systemBlocks.push({
    type: "text",
    text: BASE_SYSTEM_PROMPT,
    cache_control: { type: "ephemeral" },
  });

  // Block 2: Plan mode instruction (if applicable)
  if (state.mode === "plan" && !state.plan) {
    systemBlocks.push({
      type: "text",
      text:
        "## MODE: PLAN\n" +
        "You are in plan mode. You can ONLY use read-only tools (read_file, list_directory, glob, search_files, search_code, recall_memory). " +
        "Explore the codebase, understand the task, then create a plan with create_plan and call request_plan_approval. " +
        "Do NOT make any edits.",
    });
  }

  // Block 3: Always-on memory (conventions + architecture — stable per project)
  if (state.alwaysOnMemory) {
    systemBlocks.push({
      type: "text",
      text: state.alwaysOnMemory,
      cache_control: { type: "ephemeral" },
    });
  }

  // Block 4: Surfaced memories (changes per invocation)
  if (state.surfacedMemories) {
    systemBlocks.push({
      type: "text",
      text: state.surfacedMemories,
    });
  }

  // ── Invoke model ──────────────────────────────────────────────────────────
  const model = new ChatAnthropic({
    model: MODEL,
    temperature: 0,
    apiKey: process.env.ANTHROPIC_API_KEY,
  }).bindTools(allTools);

  const response = await model.invoke([
    new SystemMessage({ content: systemBlocks }),
    ...messagesForLLM,
  ]);

  const newMessages: BaseMessage[] = [response];

  // ── Process tool calls ─────────────────────────────────────────────────────
  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolReturnedAIMessages: BaseMessage[] = [];
    for (const toolCall of response.tool_calls) {
      const matched = allTools.find((t) => t.name === toolCall.name);
      let toolOutput: string;

      // Check for repetitive tool calls before executing
      const repetitionWarning = detectToolRepetition(
        messagesForLLM,
        toolCall.name,
        toolCall.args as Record<string, unknown>
      );

      if (matched) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (matched as any).invoke(toolCall.args);
          if (AIMessage.isInstance(result)) {
            const aiText =
              typeof result.content === "string"
                ? result.content
                : JSON.stringify(result.content);
            toolOutput = aiText;
            toolReturnedAIMessages.push(result);
          } else {
            toolOutput = String(result);
          }
        } catch (err) {
          toolOutput = `ERROR: Tool "${toolCall.name}" threw: ${String(err)}`;
        }
      } else {
        toolOutput = `ERROR: Unknown tool "${toolCall.name}"`;
      }

      // Append repetition warning to tool output so the model sees it
      if (repetitionWarning) {
        toolOutput += repetitionWarning;
      }

      newMessages.push(
        new ToolMessage({
          tool_call_id: toolCall.id ?? toolCall.name,
          content: toolOutput,
        })
      );
    }
    if (toolReturnedAIMessages.length > 0) {
      newMessages.push(...toolReturnedAIMessages);
    }
  } else {
    // No tool calls = agent is responding directly to the user.
    // For simple QA, greetings, etc. — mark as finished.
    controlCtx.finished = true;
  }

  // ── Return updated state ──────────────────────────────────────────────────
  // messagesStateReducer handles appending. If compaction happened, we first
  // emit RemoveMessage ops for old messages + the summary, then new messages.
  const messageUpdates = compactionOps
    ? [...compactionOps, ...newMessages]
    : newMessages;

  return {
    messages: messageUpdates,
    iterationCount: state.iterationCount + 1,
    finished: controlCtx.finished,
    plan: controlCtx.plan,
    generatedDiffs: controlCtx.generatedDiffs,
    mode: controlCtx.mode,
  };
}
