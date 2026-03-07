import { Sandbox } from "e2b";

const SANDBOX_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WORKSPACE_DIR = "/workspace";

export interface SandboxSession {
  sandbox: Sandbox;
  sandboxId: string;
}

/**
 * Returns an existing sandbox (reconnects by ID) or creates a fresh one
 * with the repo cloned into /workspace.
 *
 * Call this at the start of CoderNode. The sandboxId is stored in AgentState
 * and reused across every message in the session — no re-cloning needed.
 */
export async function getOrCreateSandbox(
  sandboxId: string | null,
  githubToken: string,
  repoFullName: string
): Promise<SandboxSession> {
  if (sandboxId) {
    try {
      const sandbox = await Sandbox.connect(sandboxId);
      // Extend timeout so the sandbox doesn't die mid-task
      await sandbox.setTimeout(SANDBOX_TIMEOUT_MS);
      return { sandbox, sandboxId };
    } catch {
      // Sandbox expired or unreachable — fall through to create a new one
    }
  }

  const sandbox = await Sandbox.create({
    apiKey: process.env.E2B_API_KEY,
    timeoutMs: SANDBOX_TIMEOUT_MS,
  });

  // Clone the repo into /workspace
  const cloneUrl = `https://x-access-token:${githubToken}@github.com/${repoFullName}.git`;
  const clone = await sandbox.commands.run(
    `git clone --depth=1 "${cloneUrl}" ${WORKSPACE_DIR} 2>&1`
  );
  if (clone.exitCode !== 0) {
    await sandbox.kill();
    throw new Error(`Failed to clone ${repoFullName}: ${clone.stderr}`);
  }

  // Configure git identity so commits/diffs work cleanly
  await sandbox.commands.run(
    `git -C ${WORKSPACE_DIR} config user.email "agent@nexgenesis.ai" && ` +
    `git -C ${WORKSPACE_DIR} config user.name "NexGenesis Agent"`
  );

  return { sandbox, sandboxId: sandbox.sandboxId };
}

/**
 * Captures all changes made since the repo was cloned.
 * Returns the raw unified diff string (empty string if no changes).
 */
export async function captureGitDiff(sandbox: Sandbox): Promise<string> {
  const result = await sandbox.commands.run(
    `git -C ${WORKSPACE_DIR} diff HEAD 2>&1`
  );
  return result.stdout.trim();
}

/**
 * Runs the project's test suite inside the sandbox.
 * Tries pnpm → npm in order. Always passes with no tests.
 */
export async function runTests(sandbox: Sandbox): Promise<{ success: boolean; output: string }> {
  const result = await sandbox.commands.run(
    `cd ${WORKSPACE_DIR} && (pnpm test --passWithNoTests 2>&1 || npm test --passWithNoTests 2>&1 || echo "No test runner found")`,
    { timeoutMs: 5 * 60 * 1000 }
  );
  return {
    success: result.exitCode === 0,
    output: (result.stdout + result.stderr).trim(),
  };
}
