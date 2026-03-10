import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type {
  AgentMode,
  PlanStep,
  FileDiff,
  MemoryExtractionStatus,
} from "@workspace/types";

/** Scalar last-write-wins reducer — replaces the current value with the update. */
function replace<T>(_current: T, update: T): T {
  return update;
}

/**
 * Agent v2 state — single agentic loop inspired by Claude Code.
 *
 * Compared to v1: removed taskType (no classifier), currentStepIndex,
 * retrievedChunks, executionResult, reviewResult, retryCount, memoryContext.
 * Added: mode, alwaysOnMemory, surfacedMemories, iterationCount, finished.
 */
export const AgentStateAnnotation = Annotation.Root({
  // ── Core conversation ─────────────────────────────────────────────────────
  messages: Annotation<BaseMessage[]>({
    value: messagesStateReducer,
    default: () => [],
  }),

  // ── Identity (set once per invocation) ────────────────────────────────────
  sessionId: Annotation<string>({ value: replace, default: () => "" }),
  projectId: Annotation<string>({ value: replace, default: () => "" }),
  orgId: Annotation<string>({ value: replace, default: () => "" }),

  // ── Mode ──────────────────────────────────────────────────────────────────
  // "plan" = read-only tools, creates plan, interrupts for approval, then switches to "auto"
  // "auto" = full tool access, agent decides everything
  mode: Annotation<AgentMode>({
    value: replace,
    default: () => "auto" as AgentMode,
  }),

  // ── E2B Sandbox ───────────────────────────────────────────────────────────
  sandboxId: Annotation<string | null>({ value: replace, default: () => null }),

  // ── Memory ────────────────────────────────────────────────────────────────
  // Always-on context (~2-3K tokens): conventions + architecture rules
  alwaysOnMemory: Annotation<string>({ value: replace, default: () => "" }),
  // Proactively surfaced memories from embedding search (set in initNode)
  surfacedMemories: Annotation<string>({ value: replace, default: () => "" }),

  // ── Loop control ──────────────────────────────────────────────────────────
  iterationCount: Annotation<number>({ value: replace, default: () => 0 }),
  finished: Annotation<boolean>({ value: replace, default: () => false }),

  // ── Outputs ───────────────────────────────────────────────────────────────
  generatedDiffs: Annotation<FileDiff[]>({ value: replace, default: () => [] }),

  // ── Plan (optional, created by agent when it decides to plan) ─────────────
  plan: Annotation<PlanStep[] | null>({ value: replace, default: () => null }),

  // ── Memory extraction ─────────────────────────────────────────────────────
  memoryExtractionStatus: Annotation<MemoryExtractionStatus>({
    value: replace,
    default: () => null,
  }),
});

export type AgentStateType = typeof AgentStateAnnotation.State;
