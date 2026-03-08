import { auth } from "@clerk/nextjs/server";
import { createSupabaseServiceRoleClient } from "@workspace/db";
import { createGitHubApp, getInstallationOctokit } from "@workspace/github";

const supabase = createSupabaseServiceRoleClient({
  url: process.env.SUPABASE_URL!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
});

const app = createGitHubApp({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
});

export async function GET() {
  const { userId, orgId } = await auth();
  console.log("[github/repos] userId:", userId, "orgId:", orgId);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!orgId) {
    console.log("[github/repos] No orgId — returning not connected");
    return Response.json({ connected: false, repos: [] });
  }

  // Look up the org's GitHub App installation ID
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("githubinstallationid")
    .eq("clerkorgid", orgId)
    .single();

  console.log("[github/repos] org lookup:", { org, orgError: orgError?.message });

  const installationId = org?.githubinstallationid;
  if (!installationId) {
    console.log("[github/repos] No installationId — returning not connected");
    return Response.json({ connected: false, repos: [] });
  }

  try {
    const octokit = await getInstallationOctokit(app, installationId);

    // List all repos accessible to this installation (includes private repos)
    const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({
      per_page: 100,
    });

    const repos = data.repositories.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      url: r.html_url,
      defaultBranch: r.default_branch,
      private: r.private,
      description: r.description ?? null,
    }));

    return Response.json({ connected: true, repos });
  } catch (error) {
    console.error("Failed to list repos from GitHub App installation:", error);
    return Response.json({ connected: false, repos: [] });
  }
}
