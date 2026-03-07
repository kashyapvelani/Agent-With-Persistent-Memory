import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type {
  TaskType,
  PlanStep,
  CodeChunk,
  FileDiff,
  ExecutionResult,
  ReviewResult,
  MemoryExtractionStatus,
} from "@workspace/types";

// Scalar last-write-wins reducer — replaces the current value with the update
function replace<T>(_current: T, update: T): T {
  return update;
}

export const AgentStateAnnotation = Annotation.Root({
  // LangChain message history — appends new messages (v1.x uses `value`, not `reducer`)
  messages: Annotation<BaseMessage[]>({
    value: messagesStateReducer,
    default: () => [],
  }),

  // Session / project identity (set once at graph invocation)
  sessionId: Annotation<string>({ value: replace, default: () => "" }),
  projectId: Annotation<string>({ value: replace, default: () => "" }),
  orgId: Annotation<string>({ value: replace, default: () => "" }),

  // Classifier output
  taskType: Annotation<TaskType>({ value: replace, default: () => "qa" as TaskType }),

  // Planner output
  plan: Annotation<PlanStep[] | null>({ value: replace, default: () => null }),
  currentStepIndex: Annotation<number>({ value: replace, default: () => 0 }),

  // Retrieval
  retrievedChunks: Annotation<CodeChunk[]>({ value: replace, default: () => [] }),

  // Memory context block injected into Planner/Coder system prompts
  memoryContext: Annotation<string | null>({ value: replace, default: () => null }),

  // E2B sandbox ID — reused across all nodes in the same session (avoids re-cloning)
  sandboxId: Annotation<string | null>({ value: replace, default: () => null }),

  // Coder output
  generatedDiffs: Annotation<FileDiff[]>({ value: replace, default: () => [] }),

  // Executor output
  executionResult: Annotation<ExecutionResult | null>({ value: replace, default: () => null }),

  // Reviewer output
  reviewResult: Annotation<ReviewResult | null>({ value: replace, default: () => null }),

  // Retry counter (Reviewer → Coder loop, max 3)
  retryCount: Annotation<number>({ value: replace, default: () => 0 }),

  // Async memory extraction status (emitted as custom stream event)
  memoryExtractionStatus: Annotation<MemoryExtractionStatus>({
    value: replace,
    default: () => null,
  }),
});

export type AgentStateType = typeof AgentStateAnnotation.State;
