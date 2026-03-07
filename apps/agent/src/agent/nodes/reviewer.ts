import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { interrupt } from "@langchain/langgraph";
import { createSupabaseServiceRoleClient } from "@workspace/db";
import type { AgentStateType } from "../state.js";
import type { ReviewResult } from "@workspace/types";

const MODEL = "claude-sonnet-4-6";

/**
 * ReviewerNode — Claude Sonnet 4.6
 * 1. Runs an automated review: checks diff satisfies request, no arch violations,
 *    no syntax/import errors.
 * 2. Interrupts with the review result — user can approve or override.
 * 3. Returns the final review result (may differ from automated one if user overrides).
 */
export async function reviewerNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const originalRequest = state.messages
    .slice()
    .find((m) => HumanMessage.isInstance(m));
  const requestText =
    typeof originalRequest?.content === "string"
      ? originalRequest.content
      : "";

  // Fetch architecture rules for violation checks
  const supabase = createSupabaseServiceRoleClient({
    url: process.env.SUPABASE_URL!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  });
  const { data: arch } = await supabase
    .from("projectArchitecture")
    .select("architecture")
    .eq("projectId", state.projectId)
    .maybeSingle();

  const archRules =
    arch?.architecture?.rules
      ?.map((r: string) => `- ${r}`)
      .join("\n") ?? "None specified.";

  const diffsText = state.generatedDiffs
    .map((d) => `=== ${d.file} ===\n${d.patch}`)
    .join("\n\n");

  const executionSummary = state.executionResult
    ? `Execution result: ${state.executionResult.success ? "PASSED" : "FAILED"}\n${state.executionResult.output}\n${state.executionResult.errors.join("\n")}`
    : "Execution result: not available";

  const model = new ChatAnthropic({
    model: MODEL,
    temperature: 0,
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const response = await model.invoke([
    new SystemMessage(
      `You are a senior code reviewer. Review the generated diffs and check all of the following:
1. Does the diff fully satisfy the original user request?
2. Does it violate any architecture rules listed below?
3. Are there syntax errors, broken imports, or missing edge cases?
4. Is the diff clean (no debug code, no unrelated changes)?

Architecture rules to enforce:
${archRules}

${executionSummary}

Respond with JSON only:
{ "approved": boolean, "feedback": string }

If approved: feedback should be a brief confirmation of what was done correctly.
If not approved: feedback must be specific and actionable — list each issue clearly.`
    ),
    new HumanMessage(
      `Original request: ${requestText}\n\nGenerated diffs:\n${diffsText}`
    ),
  ]);

  let automatedReview: ReviewResult = { approved: false, feedback: "" };
  try {
    const text =
      typeof response.content === "string" ? response.content : "";
    const clean = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
    automatedReview = JSON.parse(clean) as ReviewResult;
  } catch {
    automatedReview = {
      approved: true,
      feedback: "Automated review parsing failed — auto-approved.",
    };
  }

  // ── Human-in-the-loop: show review to user ───────────────────────────────
  // Frontend renders the diff + review result. User can approve or reject.
  // Resume payload: { action: "approve" | "reject", feedback?: string }
  const humanFeedback = interrupt({
    type: "review_result",
    reviewResult: automatedReview,
    diffs: state.generatedDiffs,
    executionResult: state.executionResult,
  }) as { action: "approve" | "reject"; feedback?: string };

  const finalApproved = humanFeedback.action === "approve";
  const finalFeedback = humanFeedback.feedback ?? automatedReview.feedback;

  return {
    reviewResult: { approved: finalApproved, feedback: finalFeedback },
  };
}
