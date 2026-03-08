import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@workspace/db";
import { clerkClient } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";

const supabase = createSupabaseServiceRoleClient({
  url: process.env.SUPABASE_URL!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
});

/**
 * GitHub App installation callback.
 *
 * GitHub redirects here after the user installs/updates the app:
 *   GET /api/github/callback?installation_id=xxx&setup_action=install&state=<clerkOrgId>
 *
 * The `state` param carries the Clerk org ID so we can store the installation
 * on the correct organization row. Uses upsert so the org row is created if
 * it doesn't exist yet (webhooks don't work locally).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const installationId = searchParams.get("installation_id");
  const setupAction = searchParams.get("setup_action");
  const clerkOrgId = searchParams.get("state");

  if (!installationId || !setupAction) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (clerkOrgId) {
    // Fetch org name from Clerk so we can upsert the full row
    let orgName = "Unknown";
    try {
      const client = await clerkClient();
      const org = await client.organizations.getOrganization({ organizationId: clerkOrgId });
      orgName = org.name;
    } catch (e) {
      console.error("Failed to fetch org from Clerk:", e);
    }

    // Upsert — creates the org row if it doesn't exist yet
    const { error } = await supabase
      .from("organizations")
      .upsert(
        {
          id: randomUUID(),
          clerkorgid: clerkOrgId,
          name: orgName,
          githubinstallationid: Number(installationId),
        },
        { onConflict: "clerkorgid" }
      );

    if (error) {
      console.error("Failed to store githubinstallationid on org:", error.message);
    }
  }

  return NextResponse.redirect(new URL("/dashboard", req.url));
}
