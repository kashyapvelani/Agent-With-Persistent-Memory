"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../../hooks/use-workspace";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@workspace/ui/components/ai-elements/message";
import {
  Plan,
  PlanHeader,
  PlanTitle,
  PlanDescription,
  PlanContent,
  PlanFooter,
  PlanAction,
  PlanTrigger,
} from "@workspace/ui/components/ai-elements/plan";
import { ToolCallGroup } from "./tool-message";
import type { FileDiff, PlanStep } from "@workspace/types";
import type { Message as LGMessage } from "@langchain/langgraph-sdk";

import { TextChangeAnimation } from "./text-animation";

const HIDDEN_TOOL_CALLS = new Set([
  "recall_memory",
  "finish",
  "request_review_approval",
  "request_plan_approval",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasTextContent(msg: LGMessage): boolean {
  if (typeof msg.content === "string") return msg.content.trim().length > 0;
  if (Array.isArray(msg.content)) {
    return msg.content.some(
      (c) => c.type === "text" && (c as { text: string }).text.trim().length > 0,
    );
  }
  return false;
}

function getTextContent(msg: LGMessage): string {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text)
      .join("\n");
  }
  return "";
}

// ---------------------------------------------------------------------------
// Interrupt types (matching agent's control-tools.ts payloads)
// ---------------------------------------------------------------------------

interface PlanApprovalInterruptPayload {
  type: "plan_approval";
  plan: PlanStep[];
  summary?: string;
}

interface ReviewResultInterruptPayload {
  type: "review_result";
  diffs?: FileDiff[];
  summary?: string;
  selfReviewNotes?: string | null;
}

type InterruptPayload =
  | PlanApprovalInterruptPayload
  | ReviewResultInterruptPayload;

function parseInterruptPayload(value: unknown): InterruptPayload | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as { type?: string };
  if (payload.type === "plan_approval") return value as PlanApprovalInterruptPayload;
  if (payload.type === "review_result") return value as ReviewResultInterruptPayload;
  return null;
}

// ---------------------------------------------------------------------------
// Main component — follows LangGraph useStream patterns
// (see: langchain-ai/langgraphjs/examples/ui-react/src/examples/)
// ---------------------------------------------------------------------------

export function ChatMessageList() {
  const { stream, interrupt, resumeInterrupt, isStreaming } = useWorkspace();
  const { messages } = stream;

  // -- Interrupt state ------------------------------------------------------
  const interruptPayload = parseInterruptPayload(interrupt?.value);
  const interruptKey = useMemo(
    () => (interrupt?.value ? JSON.stringify(interrupt.value) : null),
    [interrupt],
  );
  const [dismissedInterruptKey, setDismissedInterruptKey] = useState<string | null>(null);
  const [editedPlan, setEditedPlan] = useState<PlanStep[]>([]);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [isProcessingInterrupt, setIsProcessingInterrupt] = useState(false);
  const [interruptError, setInterruptError] = useState<string | null>(null);
  const isInterruptVisible =
    Boolean(interruptPayload) &&
    Boolean(interruptKey) &&
    interruptKey !== dismissedInterruptKey;

  useEffect(() => {
    if (interruptPayload?.type === "plan_approval") {
      setEditedPlan(interruptPayload.plan.map((step) => ({ ...step })));
    }
  }, [interruptPayload]);

  // -- Interrupt handlers ---------------------------------------------------
  const handlePlanApprove = useCallback(async () => {
    setInterruptError(null);
    setIsProcessingInterrupt(true);
    try {
      await resumeInterrupt({ action: "approve" });
      setEditedPlan([]);
      if (interruptKey) setDismissedInterruptKey(interruptKey);
    } catch (error) {
      setInterruptError(
        error instanceof Error ? error.message : "Failed to approve plan.",
      );
    } finally {
      setIsProcessingInterrupt(false);
    }
  }, [resumeInterrupt, interruptKey]);

  const handlePlanEditApprove = useCallback(async () => {
    setInterruptError(null);
    if (editedPlan.length === 0) {
      setInterruptError("Plan cannot be empty.");
      return;
    }
    const hasInvalidStep = editedPlan.some((step) => !step.description.trim());
    if (hasInvalidStep) {
      setInterruptError("Each plan row must include a description.");
      return;
    }
    setIsProcessingInterrupt(true);
    try {
      await resumeInterrupt({ action: "edit", editedPlan });
      setEditedPlan([]);
      if (interruptKey) setDismissedInterruptKey(interruptKey);
    } catch (error) {
      setInterruptError(
        error instanceof Error ? error.message : "Failed to submit edited plan.",
      );
    } finally {
      setIsProcessingInterrupt(false);
    }
  }, [editedPlan, resumeInterrupt, interruptKey]);

  const updatePlanStep = useCallback(
    (index: number, field: keyof Pick<PlanStep, "description">, value: string) => {
      setEditedPlan((prev) =>
        prev.map((step, i) => (i === index ? { ...step, [field]: value } : step)),
      );
    },
    [],
  );

  const handleReviewAction = useCallback(
    async (action: "approve" | "reject") => {
      setInterruptError(null);
      setIsProcessingInterrupt(true);
      try {
        const trimmedFeedback = reviewFeedback.trim();
        await resumeInterrupt({
          action,
          feedback: trimmedFeedback.length > 0 ? trimmedFeedback : undefined,
        });
        setReviewFeedback("");
        if (interruptKey) setDismissedInterruptKey(interruptKey);
      } catch (error) {
        setInterruptError(
          error instanceof Error ? error.message : "Failed to submit review decision.",
        );
      } finally {
        setIsProcessingInterrupt(false);
      }
    },
    [reviewFeedback, resumeInterrupt, interruptKey],
  );

  // -- Render messages directly from stream.messages ------------------------
  // Following the LangGraph example pattern: iterate messages, use
  // stream.getToolCalls(message) for AI messages, skip tool messages.

  return (
    <div className="flex flex-col gap-4">
      {messages.map((message, idx) => {
        // Skip tool messages — rendered inline via getToolCalls
        if (message.type === "tool") return null;

        // Skip system messages
        if (message.type === "system") return null;

        const key = message.id ?? idx;

        // Human messages
        if (message.type === "human") {
          const text = getTextContent(message);
          if (!text) return null;
          return (
            <Message key={key} from="user">
              <MessageContent>{text}</MessageContent>
            </Message>
          );
        }

        // AI messages — render text + tool calls
        if (message.type === "ai") {
          const text = getTextContent(message);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const toolCalls = stream
            .getToolCalls(message as any)
            .filter((tc) => !HIDDEN_TOOL_CALLS.has(tc.call.name));
          const showText = hasTextContent(message);

          // Skip AI messages with no content and no tool calls
          if (!showText && toolCalls.length === 0) return null;

          return (
            <div key={key} className="flex flex-col gap-1.5">
              {showText && (
                <Message from="assistant">
                  <MessageContent>
                    <MessageResponse>{text}</MessageResponse>
                  </MessageContent>
                </Message>
              )}

              {toolCalls.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {toolCalls.map((tc) => (
                    <ToolCallGroup
                      key={tc.id}
                      toolCall={{
                        name: tc.call.name,
                        args: tc.call.args as Record<string, unknown>,
                        id: tc.call.id,
                      }}
                      result={
                        tc.result
                          ? {
                              toolCallId: tc.id,
                              content: getTextContent(tc.result),
                              isError: tc.state === "error",
                            }
                          : undefined
                      }
                      isPending={tc.state === "pending"}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        }

        return null;
      })}

      {/* {When streaming} */
        isStreaming && (
          <TextChangeAnimation />
        )
      }

      {/* Plan Approval Interrupt */}
      {isInterruptVisible && interruptPayload?.type === "plan_approval" && (
        <Plan defaultOpen>
          <PlanHeader>
            <div>
              <PlanTitle>Plan Approval Required</PlanTitle>
              <PlanDescription>
                Review and edit the proposed steps inline, then approve.
              </PlanDescription>
            </div>
            <PlanAction>
              <PlanTrigger />
            </PlanAction>
          </PlanHeader>
          <PlanContent className="space-y-3">
            <div className="space-y-2">
              {editedPlan.map((step, index) => (
                <div key={`${step.file}-${index}`} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Step {index + 1}</Badge>
                    <span className="text-xs text-muted-foreground">{step.action}</span>
                  </div>
                  <div className="mt-2 space-y-2">
                    <p className="text-sm font-medium">{step.step}</p>
                    <p className="text-xs text-muted-foreground">{step.file}</p>
                    <Textarea
                      value={step.description}
                      onChange={(event) =>
                        updatePlanStep(index, "description", event.currentTarget.value)
                      }
                      placeholder="Step description"
                      className="min-h-20"
                      disabled={isProcessingInterrupt}
                    />
                  </div>
                </div>
              ))}
            </div>
            {interruptError && (
              <p className="text-sm text-destructive">{interruptError}</p>
            )}
          </PlanContent>
          <PlanFooter className="gap-2">
            <Button
              type="button"
              onClick={handlePlanApprove}
              disabled={isProcessingInterrupt}
            >
              Approve Plan
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handlePlanEditApprove}
              disabled={isProcessingInterrupt}
            >
              Submit Edited Plan
            </Button>
          </PlanFooter>
        </Plan>
      )}

      {/* Review Decision Interrupt */}
      {isInterruptVisible && interruptPayload?.type === "review_result" && (
        <Plan defaultOpen>
          <PlanHeader>
            <div>
              <PlanTitle>Review Decision Required</PlanTitle>
              <PlanDescription>
                Approve to finish, or reject with feedback for another coding pass.
              </PlanDescription>
            </div>
            <PlanAction>
              <PlanTrigger />
            </PlanAction>
          </PlanHeader>
          <PlanContent className="space-y-3">
            {interruptPayload.summary && (
              <p className="text-sm whitespace-pre-wrap">
                {interruptPayload.summary}
              </p>
            )}
            {interruptPayload.selfReviewNotes && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="mb-1 text-xs font-medium text-amber-600">Agent Notes</p>
                <p className="text-sm whitespace-pre-wrap">
                  {interruptPayload.selfReviewNotes}
                </p>
              </div>
            )}
            {interruptPayload.diffs && interruptPayload.diffs.length > 0 && (
              <div className="rounded-lg border p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Changed files</p>
                <ul className="space-y-1 text-sm">
                  {interruptPayload.diffs.map((diff) => (
                    <li key={diff.file}>{diff.file}</li>
                  ))}
                </ul>
              </div>
            )}
            <Textarea
              value={reviewFeedback}
              onChange={(event) => setReviewFeedback(event.currentTarget.value)}
              placeholder="Optional feedback for the agent (leave empty to approve as-is)"
              className="min-h-24"
              disabled={isProcessingInterrupt}
            />
            {interruptError && (
              <p className="text-sm text-destructive">{interruptError}</p>
            )}
          </PlanContent>
          <PlanFooter className="gap-2">
            <Button
              type="button"
              onClick={() => handleReviewAction("approve")}
              disabled={isProcessingInterrupt}
            >
              Approve
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => handleReviewAction("reject")}
              disabled={isProcessingInterrupt}
            >
              Reject
            </Button>
          </PlanFooter>
        </Plan>
      )}
    </div>
  );
}
