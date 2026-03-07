import { ChatAnthropic } from "@langchain/anthropic";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import OpenAI from "openai";
import { createSupabaseServiceRoleClient } from "@workspace/db";
import { createQdrantClient } from "@workspace/qdrant";
import { buildMemoryContext } from "@workspace/memory";
import { getOrCreateSandbox, captureGitDiff } from "../../sandbox/manager.js";
import { buildSandboxTools } from "../../sandbox/tools.js";
import type { AgentStateType } from "../state.js";
import type { FileDiff, PlanStep } from "@workspace/types";

const MODEL = "claude-sonnet-4-6";
const MAX_TOOL_ITERATIONS = 30; // per step — prevents infinite loops

const SYSTEM_PROMPT = `You are an expert software engineer with direct access to the project repository via tools. You operate like Claude Code — you can read files, edit them, run commands, and verify your changes before finishing.

## Your tools
- **read_file** — always read a file before editing it
- **edit_file** — make precise, targeted edits (preferred over write_file for existing files)
- **write_file** — create new files or fully replace a file's content
- **delete_file** — remove a file
- **list_directory** — explore the repo structure
- **glob** — find files by pattern
- **search_files** — grep across the codebase
- **run_command** — run shell commands (tests, installs, type checks)

## How to work
1. Explore first: list directories and read relevant files before making any changes
2. Make changes using edit_file (precise) or write_file (new/full rewrite)
3. After making changes, run the relevant tests or type-check to verify
4. If tests fail, read the error and fix it — keep iterating until green
5. Stop calling tools only when the task is done and verified

## Rules
- Follow all project conventions in the Project Intelligence block strictly
- Never make changes beyond what the task requires
- Never leave the repo in a broken state — if you break something, fix it before stopping`;

/**
 * Runs a single ReAct tool-calling loop for one task (a plan step or a simple fix).
 * Returns the number of iterations used.
 */
async function runReActLoop(
  model: ReturnType<InstanceType<typeof ChatAnthropic>["bindTools"]>,
  tools: ReturnType<typeof buildSandboxTools>,
  systemPrompt: string,
  userPrompt: string
): Promise<number> {
  const loopMessages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ];

  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;
    const response = await model.invoke(loopMessages);
    loopMessages.push(response);

    // No tool calls → Claude is done with this step
    if (!response.tool_calls || response.tool_calls.length === 0) break;

    for (const toolCall of response.tool_calls) {
      const matched = tools.find((t) => t.name === toolCall.name);
      let toolOutput: string;

      if (matched) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toolOutput = String(await (matched as any).invoke(toolCall.args));
        } catch (err) {
          toolOutput = `ERROR: Tool "${toolCall.name}" threw: ${String(err)}`;
        }
      } else {
        toolOutput = `ERROR: Unknown tool "${toolCall.name}"`;
      }

      loopMessages.push(
        new ToolMessage({
          tool_call_id: toolCall.id ?? toolCall.name,
          content: toolOutput,
        })
      );
    }
  }

  return iterations;
}

/**
 * CoderNode — per-step ReAct agent powered by Claude Sonnet 4.6
 *
 * For multi-step plans: iterates through each PlanStep explicitly.
 *   - Dispatches `plan_step_update` custom events before and after each step
 *     so the frontend PlanTimeline updates in real time.
 *   - Each step gets its own focused ReAct loop (read → edit → verify).
 *
 * For simple fixes: runs a single ReAct loop with no step tracking.
 *
 * In both cases: captures `git diff HEAD` at the end as generatedDiffs.
 */
export async function coderNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const lastHumanMessage = state.messages
    .slice()
    .reverse()
    .find((m) => HumanMessage.isInstance(m));
  const userRequest =
    typeof lastHumanMessage?.content === "string"
      ? lastHumanMessage.content
      : "";

  // ── Build or reuse memory context ────────────────────────────────────────
  let memoryContext = state.memoryContext;
  if (!memoryContext) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const supabase = createSupabaseServiceRoleClient({
      url: process.env.SUPABASE_URL!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    });
    const qdrant = createQdrantClient(
      process.env.QDRANT_URL!,
      process.env.QDRANT_API_KEY
    );
    memoryContext = await buildMemoryContext(
      supabase,
      qdrant,
      openai,
      state.projectId,
      userRequest
    );
  }

  // ── Get GitHub token for sandbox clone ───────────────────────────────────
  const supabase = createSupabaseServiceRoleClient({
    url: process.env.SUPABASE_URL!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  });
  const { data: project } = await supabase
    .from("projects")
    .select("repoFullName, githubInstallationToken")
    .eq("id", state.projectId)
    .single();

  if (!project) throw new Error(`Project ${state.projectId} not found`);

  // ── Get or create E2B sandbox ─────────────────────────────────────────────
  const { sandbox, sandboxId } = await getOrCreateSandbox(
    state.sandboxId,
    project.githubInstallationToken as string,
    project.repoFullName as string
  );

  // ── Build shared system prompt ────────────────────────────────────────────
  const retryNote =
    state.reviewResult && !state.reviewResult.approved && state.retryCount > 0
      ? `\n\n## Retry #${state.retryCount}\nPrevious attempt was rejected. Reviewer feedback:\n${state.reviewResult.feedback}\nAddress every point.`
      : "";

  const baseSystemPrompt = [SYSTEM_PROMPT, memoryContext ?? "", retryNote]
    .filter(Boolean)
    .join("\n\n");

  // ── Wire tools to this sandbox ────────────────────────────────────────────
  const tools = buildSandboxTools(sandbox);
  const model = new ChatAnthropic({
    model: MODEL,
    temperature: 0,
    apiKey: process.env.ANTHROPIC_API_KEY,
  }).bindTools(tools);

  // ─────────────────────────────────────────────────────────────────────────
  // MULTI-STEP: iterate per plan step, emitting progress events
  // ─────────────────────────────────────────────────────────────────────────
  if (state.plan && state.plan.length > 0) {
    // Start with all steps marked pending (in case of retry, reset statuses)
    const plan: PlanStep[] = state.plan.map((s) => ({ ...s, status: "pending" as const }));

    // Emit initial state so frontend shows the full plan as pending
    await dispatchCustomEvent("plan_step_update", {
      type: "plan_step_update",
      plan,
    });

    for (let i = 0; i < plan.length; i++) {
      const step = plan[i]!;

      // Mark step as in_progress → emit event
      plan[i] = { ...step, status: "in_progress" };
      await dispatchCustomEvent("plan_step_update", {
        type: "plan_step_update",
        plan: [...plan],
        currentStep: i,
      });

      const stepPrompt =
        `You are working on step ${i + 1} of ${plan.length}:\n` +
        `Action: ${step.action}\n` +
        `File: ${step.file}\n` +
        `Description: ${step.description}\n\n` +
        `Read the file first (if it exists), make the required change, then verify with a quick type-check or test if applicable. ` +
        `Original request context: ${userRequest}`;

      let stepStatus: PlanStep["status"] = "completed";
      try {
        await runReActLoop(model, tools, baseSystemPrompt, stepPrompt);
      } catch (err) {
        stepStatus = "failed";
        // Don't throw — continue with remaining steps so we get partial diffs
        console.error(`Step ${i + 1} failed:`, err);
      }

      // Mark step as completed/failed → emit event
      plan[i] = { ...plan[i]!, status: stepStatus };
      await dispatchCustomEvent("plan_step_update", {
        type: "plan_step_update",
        plan: [...plan],
        currentStep: i,
      });
    }

    // Capture all changes across all steps
    const rawDiff = await captureGitDiff(sandbox);
    const generatedDiffs = parseDiffs(rawDiff);

    return {
      plan,
      generatedDiffs,
      memoryContext,
      sandboxId,
      retryCount:
        state.reviewResult && !state.reviewResult.approved
          ? state.retryCount + 1
          : state.retryCount,
      reviewResult: null,
      messages: [
        new AIMessage(
          JSON.stringify({
            type: "coder_complete",
            filesChanged: generatedDiffs.map((d) => d.file),
            stepsCompleted: plan.filter((s) => s.status === "completed").length,
            stepsFailed: plan.filter((s) => s.status === "failed").length,
          })
        ),
      ],
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SIMPLE FIX: single ReAct loop, no step tracking
  // ─────────────────────────────────────────────────────────────────────────
  const iterations = await runReActLoop(
    model,
    tools,
    baseSystemPrompt,
    `Complete the following task in the repository. Read the relevant files first, make the changes, then verify.\n\nTask: ${userRequest}`
  );

  const rawDiff = await captureGitDiff(sandbox);
  const generatedDiffs = parseDiffs(rawDiff);

  return {
    generatedDiffs,
    memoryContext,
    sandboxId,
    retryCount:
      state.reviewResult && !state.reviewResult.approved
        ? state.retryCount + 1
        : state.retryCount,
    reviewResult: null,
    messages: [
      new AIMessage(
        JSON.stringify({
          type: "coder_complete",
          filesChanged: generatedDiffs.map((d) => d.file),
          iterations,
        })
      ),
    ],
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Splits a raw `git diff HEAD` output into per-file FileDiff objects. */
function parseDiffs(rawDiff: string): FileDiff[] {
  if (!rawDiff) return [];
  return rawDiff
    .split(/(?=^diff --git )/m)
    .filter(Boolean)
    .map((block) => {
      const fileMatch = block.match(/^\+\+\+ b\/(.+)$/m);
      return { file: fileMatch?.[1] ?? "unknown", patch: block.trim() };
    });
}
