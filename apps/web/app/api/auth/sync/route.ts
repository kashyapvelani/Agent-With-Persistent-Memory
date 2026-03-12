import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { createSupabaseServiceRoleClient } from "@workspace/db";
import { randomUUID } from "crypto";

const supabase = createSupabaseServiceRoleClient({
  url: process.env.SUPABASE_URL!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
});

export async function POST() {
  const { userId, orgId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await currentUser();
  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  const primaryEmail = user.emailAddresses[0]?.emailAddress ?? null;
  const githubUsername =
    user.externalAccounts.find((a) => a.provider === "github")?.username ??
    user.username ??
    null;

  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerkid", user.id)
    .maybeSingle();
  const dbUserId = existingUser?.id ?? randomUUID();

  // Sync user
  const { error: userError } = await supabase.from("users").upsert(
    {
      id: dbUserId,
      clerkid: user.id,
      email: primaryEmail,
      githubusername: githubUsername,
    },
    { onConflict: "clerkid" }
  );

  if (userError) {
    console.error("Failed to sync user to Supabase:", userError);
    return new Response("Failed to sync user", { status: 500 });
  }

  // Sync organization if present
  if (orgId) {
    const client = await clerkClient();
    const org = await client.organizations.getOrganization({ organizationId: orgId });
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("clerkorgid", orgId)
      .maybeSingle();
    const orgUuid = existingOrg?.id ?? randomUUID();

    const { error: orgError } = await supabase.from("organizations").upsert(
      {
        id: orgUuid,
        clerkorgid: orgId,
        name: org.name,
      },
      { onConflict: "clerkorgid" }
    );

    if (orgError) {
      console.error("Failed to sync org to Supabase:", orgError);
    }
  }

  return new Response("OK", { status: 200 });
}
