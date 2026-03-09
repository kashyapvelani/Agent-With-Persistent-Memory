import "dotenv/config";
import { createSupabaseServiceRoleClient } from "@workspace/db";
import { runIndexingPipeline, createIndexingJob } from "./pipeline.js";

const POLL_INTERVAL_MS = 5_000;

function getSupabase() {
  return createSupabaseServiceRoleClient({
    url: process.env.SUPABASE_URL!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  });
}

async function pollAndIndex(): Promise<void> {
  const supabase = getSupabase();

  // Find all projects waiting to be indexed
  const { data: pendingProjects, error } = await supabase
    .from("projects")
    .select("*")
    .eq("indexstatus", "pending");

  if (error) {
    console.error("Failed to query pending projects:", error.message);
    return;
  }

  if (!pendingProjects || pendingProjects.length === 0) return;

  for (const project of pendingProjects) {
    // Optimistic lock: only proceed if still pending
    const { data: locked } = await supabase
      .from("projects")
      .update({ indexstatus: "indexing" })
      .eq("id", project.id)
      .eq("indexstatus", "pending")
      .select("id")
      .single();

    if (!locked) {
      // Another worker already picked this up
      continue;
    }

    const repoName = project.repofullname;
    console.log(`[worker] Indexing started for ${repoName}`);

    try {
      const jobId = await createIndexingJob(project.id);

      await runIndexingPipeline({
        jobId,
        projectId: project.id,
        orgId: project.orgid,
        repoFullName: repoName,
        branch: project.defaultbranch,
        installationId: project.githubinstallationid,
      });

      console.log(`[worker] Indexing complete for ${repoName}`);
    } catch (err) {
      // pipeline.ts already marks the project as failed
      console.error(`[worker] Indexing failed for ${repoName}:`, err);
    }
  }
}

async function main(): Promise<void> {
  console.log("[worker] NexGenesis indexing worker started. Polling every 5s...");

  // Run immediately, then on interval
  await pollAndIndex();
  setInterval(() => {
    pollAndIndex().catch((err) => console.error("[worker] Poll cycle error:", err));
  }, POLL_INTERVAL_MS);
}

main().catch(console.error);
