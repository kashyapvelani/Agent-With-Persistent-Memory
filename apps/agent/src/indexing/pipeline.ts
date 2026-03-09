import { createSupabaseServiceRoleClient } from "@workspace/db";
import { createQdrantClient, ensureCodeCollection, upsertCodeChunks } from "@workspace/qdrant";
import { createGitHubApp, getInstallationOctokit, getRepoTree, getFileContent } from "@workspace/github";
import { shouldIndex } from "./filter.js";
import { chunkFile } from "./chunker.js";
import { embedChunks } from "./embedder.js";
import { generateArchitecturalSummary } from "./architect.js";

// ----------------------------------------
// Helpers
// ----------------------------------------

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

// ----------------------------------------
// Types
// ----------------------------------------

export interface IndexingOptions {
  jobId: string;
  projectId: string;
  orgId: string;
  repoFullName: string;   // "owner/repo"
  branch: string;
  installationId: number;
}

// How many files to embed+upsert as a batch before committing progress
const FILE_BATCH_SIZE = 10;

// ----------------------------------------
// Main pipeline
// ----------------------------------------

export async function runIndexingPipeline(options: IndexingOptions): Promise<void> {
  const { jobId, projectId, orgId, repoFullName, branch, installationId } = options;
  const supabase = getSupabase();
  const qdrant = getQdrant();

  const [owner, repo] = repoFullName.split("/") as [string, string];

  // Mark job as running
  await supabase.from("projects").update({ indexstatus: "indexing" }).eq("id", projectId);

  try {
    // 1. Get installation Octokit
    const app = getGitHubApp();
    const octokit = await getInstallationOctokit(app, installationId);

    // 2. Get full repo tree
    const tree = await getRepoTree(octokit, owner, repo, branch);
    const indexableFiles = tree.filter((e) => e.type === "blob" && shouldIndex(e.path));

    // 3. Update job with total file count
    await supabase
      .from("indexingjobs")
      .update({ totalfiles: indexableFiles.length })
      .eq("id", jobId);

    // 4. Ensure Qdrant collection exists
    await ensureCodeCollection(qdrant, orgId, projectId);

    // 5. Get current HEAD commit SHA
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    const commitSha = refData.object.sha;

    // 6. Process files in batches
    let indexedFiles = 0;

    for (let i = 0; i < indexableFiles.length; i += FILE_BATCH_SIZE) {
      const batch = indexableFiles.slice(i, i + FILE_BATCH_SIZE);

      const chunkBatches = await Promise.all(
        batch.map(async (entry) => {
          const file = await getFileContent(octokit, owner, repo, entry.path, branch);
          return chunkFile(file.path, file.content, {
            repo: repoFullName,
            orgId,
            projectId,
          });
        })
      );

      const allChunks = chunkBatches.flat();

      if (allChunks.length > 0) {
        const points = await embedChunks(allChunks);
        await upsertCodeChunks(qdrant, orgId, projectId, points);
      }

      indexedFiles += batch.length;
      const currentFile = batch[batch.length - 1]?.path ?? "";

      // Update real-time progress
      await supabase
        .from("indexingjobs")
        .update({ indexedfiles: indexedFiles, currentfile: currentFile })
        .eq("id", jobId);
    }

    // 7. Generate architectural summary
    await generateArchitecturalSummary(projectId, orgId, repoFullName, tree);

    // 8. Mark project as ready
    await supabase
      .from("projects")
      .update({
        indexstatus: "ready",
        lastindexedat: new Date().toISOString(),
        lastindexedcommitsha: commitSha,
      })
      .eq("id", projectId);

    // 9. Mark job complete
    await supabase
      .from("indexingjobs")
      .update({ status: "complete", currentfile: null })
      .eq("id", jobId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await supabase
      .from("projects")
      .update({ indexstatus: "failed" })
      .eq("id", projectId);

    await supabase
      .from("indexingjobs")
      .update({ status: "failed", error: message })
      .eq("id", jobId);

    throw err;
  }
}

// ----------------------------------------
// Helper: create an indexing job row and return its ID
// ----------------------------------------

export async function createIndexingJob(projectId: string): Promise<string> {
  const { randomUUID } = await import("crypto");
  const supabase = getSupabase();
  const jobId = randomUUID();

  await supabase.from("indexingjobs").insert({
    id: jobId,
    projectid: projectId,
    status: "running",
    indexedfiles: 0,
  });

  return jobId;
}
