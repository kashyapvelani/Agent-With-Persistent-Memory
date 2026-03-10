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

  // Ensure the workspace directory exists and is writable.
  // E2B's default sandbox user may not have permission to create dirs at /.
  await sandbox.commands.run(
    `sudo mkdir -p ${WORKSPACE_DIR} && sudo chown $(whoami):$(whoami) ${WORKSPACE_DIR}`
  );

  // Clone the repo into /workspace
  const token = githubToken.trim();
  console.log(
    `[sandbox] Cloning ${repoFullName} (token: ${token ? `${token.slice(0, 8)}...` : "NONE"})`
  );
  const cloneUrl =
    token.length > 0
      ? `https://x-access-token:${token}@github.com/${repoFullName}.git`
      : `https://github.com/${repoFullName}.git`;

  // E2B's sandbox.commands.run() throws CommandExitError on non-zero exit codes
  // rather than returning a result with exitCode. We must catch it to provide
  // a useful error message with the token hint.
  try {
    // Redirect stderr→stdout so git's error messages are captured in stdout
    // (CommandExitError exposes stdout/stderr from the result)
    await sandbox.commands.run(
      `GIT_TERMINAL_PROMPT=0 git clone --depth=1 "${cloneUrl}" ${WORKSPACE_DIR} 2>&1`,
      { timeoutMs: 2 * 60 * 1000 }
    );
  } catch (err) {
    await sandbox.kill();

    // CommandExitError implements CommandResult with stdout, stderr, exitCode, error getters
    const errObj = err as { stderr?: string; stdout?: string; error?: string; message?: string };
    const gitOutput = errObj.stdout || errObj.stderr || errObj.error || "";
    const details = gitOutput || errObj.message || String(err);

    // Tailor the hint based on the actual error
    let hint: string;
    if (details.includes("Permission denied")) {
      hint = "Sandbox filesystem permission error. The workspace directory could not be created.";
    } else if (details.includes("Repository not found") || details.includes("not found")) {
      hint = token.length === 0
        ? "No GitHub token was provided. Public repos can clone without a token; private repos require one."
        : "The repository was not found. Check that the GitHub App has access to this repository.";
    } else if (details.includes("Authentication failed") || details.includes("could not read Username")) {
      hint = "GitHub authentication failed. The token may be expired or invalid.";
    } else {
      hint = token.length === 0
        ? "No GitHub token was provided."
        : "A GitHub token was provided but the clone still failed.";
    }

    throw new Error(
      `Failed to clone ${repoFullName}. ${hint}\ngit output: ${details}`
    );
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
