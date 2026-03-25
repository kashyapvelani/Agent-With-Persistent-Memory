import { auth } from "@clerk/nextjs/server";
import { Sandbox } from "e2b";
import { createSupabaseServiceRoleClient } from "@workspace/db";
import {
  createGitHubApp,
  getInstallationOctokit,
} from "@workspace/github";
import { randomUUID } from "crypto";

const supabase = createSupabaseServiceRoleClient({
  url: process.env.SUPABASE_URL!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
});

const WORKSPACE_DIR = "/workspace";

/**
 * POST /api/sandbox/commit
 *
 * Commits all changes from the E2B sandbox, pushes to a new `ADE/{uuid}`
 * branch, and opens a PR against the project's default branch.
 *
 * Body: { sandboxId: string, projectId: string, commitMessage?: string }
 * Returns: { prUrl: string, prNumber: number, branch: string }
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const { sandboxId, projectId, commitMessage } = body as {
    sandboxId: string;
    projectId: string;
    commitMessage?: string;
  };

  if (!sandboxId || !projectId) {
    return Response.json(
      { error: "Missing sandboxId or projectId" },
      { status: 400 },
    );
  }

  // 1. Fetch project to get repo info + installation ID
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return Response.json(
      { error: "Project not found" },
      { status: 404 },
    );
  }

  const repoFullName = project.repofullname as string;
  const defaultBranch = (project.defaultbranch as string) || "main";
  const installationId = project.githubinstallationid as number | null;

  if (!installationId) {
    return Response.json(
      { error: "No GitHub App installation found for this project" },
      { status: 400 },
    );
  }

  // 2. Get fresh installation token via GitHub App
  const app = createGitHubApp({
    appId: process.env.GITHUB_APP_ID!,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
  });
  const octokit = await getInstallationOctokit(app, installationId);

  // Get a fresh installation access token for git push
  const { data: tokenData } =
    await octokit.rest.apps.createInstallationAccessToken({
      installation_id: installationId,
    });
  const freshToken = tokenData.token;

  // 3. Connect to the sandbox
  let sandbox: Sandbox;
  try {
    sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY,
    });
  } catch {
    return Response.json(
      { error: "Sandbox has expired or is not running" },
      { status: 410 },
    );
  }

  // 4. Check if there are any changes to commit
  const statusResult = await sandbox.commands.run(
    `git -C ${WORKSPACE_DIR} status --porcelain 2>&1`,
  );
  const hasChanges = statusResult.stdout.trim().length > 0;

  if (!hasChanges) {
    return Response.json(
      { error: "No changes to commit" },
      { status: 400 },
    );
  }

  // 5. Create branch, stage, commit, push
  const branchId = randomUUID().slice(0, 8);
  const branch = `ADE/${branchId}`;
  const message = commitMessage || "ADE: apply agent changes";

  try {
    // Create and switch to the new branch
    await sandbox.commands.run(
      `git -C ${WORKSPACE_DIR} checkout -b "${branch}" 2>&1`,
    );

    // Stage all changes (including new/untracked files)
    await sandbox.commands.run(
      `git -C ${WORKSPACE_DIR} add -A 2>&1`,
    );

    // Commit
    await sandbox.commands.run(
      `git -C ${WORKSPACE_DIR} commit -m "${message.replace(/"/g, '\\"')}" 2>&1`,
    );

    // Update remote URL with fresh token for push auth
    const pushUrl = `https://x-access-token:${freshToken}@github.com/${repoFullName}.git`;
    await sandbox.commands.run(
      `git -C ${WORKSPACE_DIR} remote set-url origin "${pushUrl}" 2>&1`,
    );

    // Push to remote
    await sandbox.commands.run(
      `git -C ${WORKSPACE_DIR} push -u origin "${branch}" 2>&1`,
      { timeoutMs: 2 * 60 * 1000 },
    );
  } catch (err) {
    const errObj = err as { stdout?: string; stderr?: string; message?: string };
    const detail = errObj.stdout || errObj.stderr || errObj.message || String(err);
    console.error("[sandbox/commit] Git operation failed:", detail);
    return Response.json(
      { error: `Git operation failed: ${detail}` },
      { status: 500 },
    );
  }

  // 6. Create PR via Octokit
  const parts = repoFullName.split("/");
  const owner = parts[0]!;
  const repo = parts[1]!;
  try {
    const { data: pr } = await octokit.rest.pulls.create({
      owner,
      repo,
      head: branch,
      base: defaultBranch,
      title: message,
      body: [
        "## Changes",
        "",
        "Applied by [ADE](https://ADE.ai) AI agent.",
        "",
        `Branch: \`${branch}\``,
      ].join("\n"),
    });

    return Response.json({
      prUrl: pr.html_url,
      prNumber: pr.number,
      branch,
    });
  } catch (err) {
    const errObj = err as { message?: string };
    console.error("[sandbox/commit] PR creation failed:", errObj.message);
    return Response.json(
      { error: `PR creation failed: ${errObj.message}` },
      { status: 500 },
    );
  }
}
