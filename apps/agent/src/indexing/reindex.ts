import { createSupabaseServiceRoleClient } from "@workspace/db";
import { createQdrantClient, ensureCodeCollection, upsertCodeChunks, deleteFileChunks } from "@workspace/qdrant";
import { createGitHubApp, getInstallationOctokit, getRepoTree, getFileContent } from "@workspace/github";
import { shouldIndex } from "./filter.js";
import { chunkFile } from "./chunker.js";
import { embedChunks } from "./embedder.js";
import { generateArchitecturalSummary } from "./architect.js";
import { createIndexingJob } from "./pipeline.js";

function getSupabase() {
  return createSupabaseServiceRoleClient({
    url: process.env.SUPABASE_URL!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  });
}

function getQdrant() {
  return createQdrantClient(process.env.QDRANT_URL!, process.env.QDRANT_API_KEY);
}

function getGitHubApp() {
  return createGitHubApp({
    appId: process.env.GITHUB_APP_ID!,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
  });
}

export interface IncrementalReindexOptions {
  projectId: string;
  orgId: string;
  repoFullName: string;
  branch: string;
  installationId: number;
  lastIndexedCommitSha: string;
}

/**
 * Incremental re-index: compare HEAD against the last indexed commit,
 * re-embed only changed/added files, delete removed files from Qdrant.
 *
 * If >20% of files changed, also regenerates the architectural summary.
 */
export async function runIncrementalReindex(options: IncrementalReindexOptions): Promise<void> {
  const { projectId, orgId, repoFullName, branch, installationId, lastIndexedCommitSha } = options;

  const supabase = getSupabase();
  const qdrant = getQdrant();
  const [owner, repo] = repoFullName.split("/") as [string, string];

  const app = getGitHubApp();
  const octokit = await getInstallationOctokit(app, installationId);

  // 1. Get HEAD SHA
  const { data: refData } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  const headSha = refData.object.sha;

  if (headSha === lastIndexedCommitSha) {
    // Nothing changed
    return;
  }

  // 2. Compare base..head to find changed files
  const { data: comparison } = await octokit.rest.repos.compareCommits({
    owner,
    repo,
    base: lastIndexedCommitSha,
    head: headSha,
  });

  const changedFiles = (comparison.files ?? []).filter((f) =>
    f.status !== "removed" && shouldIndex(f.filename)
  );
  const removedFiles = (comparison.files ?? []).filter((f) =>
    f.status === "removed" && shouldIndex(f.filename)
  );

  const totalIndexableInRepo = (await getRepoTree(octokit, owner, repo, branch)).filter(
    (e) => e.type === "blob" && shouldIndex(e.path)
  ).length;

  // 3. Create a job for progress tracking
  const jobId = await createIndexingJob(projectId);

  await supabase
    .from("projects")
    .update({ indexStatus: "indexing" })
    .eq("id", projectId);

  await supabase
    .from("indexingJobs")
    .update({ totalFiles: changedFiles.length + removedFiles.length })
    .eq("id", jobId);

  try {
    await ensureCodeCollection(qdrant, orgId, projectId);

    // 4. Delete chunks for removed files
    for (const f of removedFiles) {
      await deleteFileChunks(qdrant, orgId, projectId, f.filename);
    }

    // 5. Re-index changed/added files
    let processed = 0;
    for (const f of changedFiles) {
      // Remove stale chunks first
      await deleteFileChunks(qdrant, orgId, projectId, f.filename);

      const file = await getFileContent(octokit, owner, repo, f.filename, branch);
      const chunks = chunkFile(file.path, file.content, { repo: repoFullName, orgId, projectId });

      if (chunks.length > 0) {
        const points = await embedChunks(chunks);
        await upsertCodeChunks(qdrant, orgId, projectId, points);
      }

      processed++;
      await supabase
        .from("indexingJobs")
        .update({ indexedFiles: processed, currentFile: f.filename })
        .eq("id", jobId);
    }

    // 6. Regenerate architectural summary if >20% of files changed
    const changeRatio = changedFiles.length / Math.max(totalIndexableInRepo, 1);
    if (changeRatio > 0.2) {
      const fullTree = await getRepoTree(octokit, owner, repo, branch);
      await generateArchitecturalSummary(projectId, orgId, repoFullName, fullTree);
    }

    // 7. Update project
    await supabase
      .from("projects")
      .update({
        indexStatus: "ready",
        lastIndexedAt: new Date().toISOString(),
        lastIndexedCommitSha: headSha,
      })
      .eq("id", projectId);

    await supabase
      .from("indexingJobs")
      .update({ status: "complete", currentFile: null })
      .eq("id", jobId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await supabase.from("projects").update({ indexStatus: "failed" }).eq("id", projectId);
    await supabase
      .from("indexingJobs")
      .update({ status: "failed", error: message })
      .eq("id", jobId);

    throw err;
  }
}
