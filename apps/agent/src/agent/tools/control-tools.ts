import { tool } from "@langchain/core/tools";
import { AIMessage } from "@langchain/core/messages";
import { z } from "zod";
import { interrupt } from "@langchain/langgraph";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import type { Sandbox } from "e2b";
import { captureGitDiff } from "../../sandbox/manager.js";
import type { PlanStep, FileDiff } from "@workspace/types";

const PlanStepSchema = z.object({
  step: z.string().describe("Short label for this step"),
  file: z.string().describe("Primary file affected"),
  action: z.string().describe("Action: create, edit, delete, or other"),
  description: z.string().describe("What this step does"),
  status: z
    .enum(["pending", "in_progress", "completed", "failed"])
    .default("pending"),
});

/**
 * State container passed to control tools so they can read/write shared state.
 * The agentLoopNode sets these before each iteration.
 */
export interface ControlToolsContext {
  sandbox: Sandbox | null;
  plan: PlanStep[] | null;
  generatedDiffs: FileDiff[];
  finished: boolean;
  mode: "plan" | "auto";
}

/**
 * Builds control flow tools that the agent uses to manage its own lifecycle.
 * These tools interact with the graph via interrupt() and custom events.
 */
export function buildControlFlowTools(ctx: ControlToolsContext) {
  const createPlan = tool(
    async ({ steps }) => {
      const plan: PlanStep[] = steps.map((s) => ({
        ...s,
        status: "pending" as const,
      }));
      ctx.plan = plan;
      await dispatchCustomEvent("plan_step_update", {
        type: "plan_step_update",
        plan,
      });
      return `Plan created with ${plan.length} steps:\n${plan.map((s, i) => `${i + 1}. [${s.action}] ${s.file} — ${s.description}`).join("\n")}`;
    },
    {
      name: "create_todo",
      description:
        "Create a structured execution TODO list. Use this for multi-step tasks to organize your work. Each step tracks file, action, and description. The plan is sent to the frontend for display.",
      schema: z.object({
        steps: z.array(PlanStepSchema).describe("Array of plan steps"),
      }),
    }
  );

  const updatePlanStep = tool(
    async ({ stepIndex, status }) => {
      if (!ctx.plan || stepIndex < 0 || stepIndex >= ctx.plan.length) {
        return `ERROR: Invalid step index ${stepIndex}. Plan has ${ctx.plan?.length ?? 0} steps.`;
      }
      ctx.plan[stepIndex]!.status = status;
      await dispatchCustomEvent("plan_step_update", {
        type: "plan_step_update",
        plan: ctx.plan,
      });
      return `Step ${stepIndex + 1} marked as ${status}.`;
    },
    {
      name: "update_todo",
      description:
        "Update the status of a TODO step. Call this when starting (in_progress), completing (completed), or failing (failed) a step.",
      schema: z.object({
        stepIndex: z
          .number()
          .int()
          .describe("Zero-based index of the step to update"),
        status: z
          .enum(["in_progress", "completed", "failed"])
          .describe("New status for the step"),
      }),
    }
  );

  const requestPlanApproval = tool(
    async ({ summary }) => {
      if (!ctx.plan || ctx.plan.length === 0) {
        return "ERROR: No plan created. Call create_plan first.";
      }

      await dispatchCustomEvent("plan_step_update", {
        type: "plan_step_update",
        plan: ctx.plan,
      });

      // Interrupt the graph — frontend must resume with { action: "approve" | "edit" }
      const humanResponse = interrupt({
        type: "plan_approval",
        plan: ctx.plan,
        summary,
      });

      // After resume
      ctx.mode = "auto"; // Switch to auto mode after plan approval

      const response = humanResponse as {
        action: string;
        editedPlan?: PlanStep[];
      };

      if (response.action === "edit" && response.editedPlan) {
        ctx.plan = response.editedPlan;
        return `Plan updated by user. ${ctx.plan.length} steps. Proceeding with execution.`;
      }

      return `Plan approved. ${ctx.plan.length} steps. Proceeding with execution.`;
    },
    {
      name: "request_plan_approval",
      description:
        "Present the current plan to the user for approval. Use this in plan mode after creating a plan with create_plan. The user can approve or edit the plan. After approval, you gain write access to execute the plan.",
      schema: z.object({
        summary: z
          .string()
          .describe("Brief summary of what the plan will accomplish"),
      }),
    }
  );

  const requestReviewApproval = tool(
    async ({ summary, selfReviewNotes }) => {
      // Capture current diffs from sandbox
      let diffs: FileDiff[] = [];
      if (ctx.sandbox) {
        try {
          const rawDiff = await captureGitDiff(ctx.sandbox);
          if (rawDiff) {
            diffs = parseDiffs(rawDiff);
            ctx.generatedDiffs = diffs;
          }
        } catch {
          // Sandbox may have expired
        }
      }

      const humanResponse = interrupt({
        type: "review_result",
        diffs,
        summary,
        selfReviewNotes: selfReviewNotes ?? null,
      });

      const response = humanResponse as {
        action: string;
        feedback?: string;
      };

      if (response.action === "reject") {
        return `REJECTED: ${response.feedback ?? "No feedback provided."}. Address the feedback and try again.`;
      }

      ctx.finished = true;
      return "Changes approved by user.";
    },
    {
      name: "request_review_approval",
      description:
        "Present your code changes to the user for review. This captures the current git diff and shows it to the user. Use this after making code changes, before calling finish. The user can approve or reject with feedback.",
      schema: z.object({
        summary: z
          .string()
          .describe("Summary of all changes made"),
        selfReviewNotes: z
          .string()
          .optional()
          .describe("Any concerns or notes about the changes"),
      }),
    }
  );

  const finish = tool(
    async ({ summary }) => {
      // Capture final diffs if not already captured
      if (ctx.sandbox && ctx.generatedDiffs.length === 0) {
        try {
          const rawDiff = await captureGitDiff(ctx.sandbox);
          if (rawDiff) {
            ctx.generatedDiffs = parseDiffs(rawDiff);
          }
        } catch {
          // Sandbox may have expired
        }
      }
      ctx.finished = true;
      return new AIMessage({ content: summary });
    },
    {
      name: "finish",
      description:
        "Signal that the task is complete. Call this when you have finished all work. For code changes, consider calling request_review_approval first. For QA answers and explanations, call finish directly.",
      schema: z.object({
        summary: z.string().describe("Brief summary of what was accomplished"),
      }),
    }
  );

  return [createPlan, updatePlanStep, requestPlanApproval, requestReviewApproval, finish];
}

// ── Diff parsing helper ──────────────────────────────────────────────────────

function parseDiffs(rawDiff: string): FileDiff[] {
  if (!rawDiff.trim()) return [];

  return rawDiff
    .split(/(?=^diff --git )/m)
    .filter((block) => block.trim().length > 0)
    .map((block) => {
      const fileMatch = block.match(/^diff --git a\/(.+?) b\//m);
      return {
        file: fileMatch?.[1] ?? "unknown",
        patch: block,
      };
    });
}
