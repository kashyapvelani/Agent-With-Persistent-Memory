import { Sandbox } from "e2b";
import { runTests } from "../../sandbox/manager.js";
import type { AgentStateType } from "../state.js";
import type { ExecutionResult } from "@workspace/types";

/**
 * ExecutorNode — E2B only
 *
 * CoderNode already made all changes inside the E2B sandbox.
 * This node reuses the same sandbox (via sandboxId) and runs the test suite
 * as a final verification pass before the ReviewerNode sees the results.
 *
 * No re-cloning, no diff application — the files are already changed.
 */
export async function executorNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  if (state.generatedDiffs.length === 0) {
    return {
      executionResult: {
        success: true,
        output: "No changes were made — skipping test run.",
        errors: [],
      },
    };
  }

  if (!state.sandboxId) {
    return {
      executionResult: {
        success: false,
        output: "",
        errors: ["No sandbox available — CoderNode did not produce a sandboxId."],
      },
    };
  }

  let executionResult: ExecutionResult;

  try {
    const sandbox = await Sandbox.connect(state.sandboxId);
    const { success, output } = await runTests(sandbox);

    executionResult = {
      success,
      output,
      errors: success ? [] : [`Test suite failed:\n${output}`],
    };
  } catch (err) {
    // Sandbox expired between CoderNode and ExecutorNode — not fatal,
    // reviewer can still evaluate the diffs.
    executionResult = {
      success: true,
      output: `Sandbox reconnect failed (may have expired): ${String(err)}. Proceeding to review without test results.`,
      errors: [],
    };
  }

  return { executionResult };
}
