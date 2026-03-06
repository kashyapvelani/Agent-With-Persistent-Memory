import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@workspace/db";

const supabase = createSupabaseServiceRoleClient({
  url: process.env.SUPABASE_URL!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
});

/**
 * GitHub App installation callback.
 *
 * GitHub redirects here after the user installs the app:
 *   GET /api/github/callback?installation_id=xxx&setup_action=install&state=<projectId>
 *
 * When initiating the install flow, encode the projectId as the `state` param
 * in the GitHub App install URL:
 *   https://github.com/apps/<app-slug>/installations/new?state=<projectId>
 *
 * If state is absent (e.g. user installed app directly from GitHub), we redirect
 * to /dashboard so they can connect it to a project manually.
 */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const { searchParams } = new URL(req.url);
  const installationId = searchParams.get("installation_id");
  const setupAction = searchParams.get("setup_action");
  const projectId = searchParams.get("state");

  if (!installationId || setupAction !== "install") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // No project yet — installation happened outside the app flow
  if (!projectId) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Store the installation ID on the project
  const { error } = await supabase
    .from("projects")
    .update({ githubInstallationId: Number(installationId) })
    .eq("id", projectId);

  if (error) {
    console.error("Failed to store githubInstallationId:", error.message);
    return NextResponse.redirect(
      new URL(`/dashboard?error=github_callback_failed`, req.url)
    );
  }

  return NextResponse.redirect(new URL(`/projects/${projectId}`, req.url));
}
