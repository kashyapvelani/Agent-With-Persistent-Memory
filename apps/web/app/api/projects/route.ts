import { auth } from "@clerk/nextjs/server";
import { createSupabaseServiceRoleClient } from "@workspace/db";
import { randomUUID } from "crypto";
import type { Project } from "@workspace/types";

const supabase = createSupabaseServiceRoleClient({
  url: process.env.SUPABASE_URL!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProject(row: any): Project {
  return {
    id: row.id,
    orgId: row.orgid,
    ownerId: row.ownerid,
    repoFullName: row.repofullname,
    repoUrl: row.repourl,
    defaultBranch: row.defaultbranch,
    indexStatus: row.indexstatus,
    lastIndexedAt: row.lastindexedat ?? null,
    lastIndexedCommitSha: row.lastindexedcommitsha ?? null,
    githubInstallationId: row.githubinstallationid ?? null,
    createdAt: row.createdat,
  };
}

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!orgId) {
    return Response.json([]);
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("clerkorgid", orgId)
    .single();

  if (!org) {
    return Response.json([]);
  }

  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .eq("orgid", org.id)
    .order("createdat", { ascending: false });

  if (error) {
    console.error("Failed to fetch projects:", error);
    return new Response("Failed to fetch projects", { status: 500 });
  }

  return Response.json((projects ?? []).map(mapProject));
}

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const { repoFullName, repoUrl, defaultBranch } = body as {
    repoFullName: string;
    repoUrl: string;
    defaultBranch: string;
  };

  if (!repoFullName || !repoUrl || !defaultBranch) {
    return new Response("Missing required fields", { status: 400 });
  }

  // Look up internal user ID from clerkId
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("clerkid", userId)
    .single();

  if (!user) {
    return new Response("User not found in database", { status: 404 });
  }

  // Look up org and its GitHub installation ID
  let internalOrgId: string | null = null;
  let githubInstallationId: number | null = null;
  if (orgId) {
    const { data: org } = await supabase
      .from("organizations")
      .select("id, githubinstallationid")
      .eq("clerkorgid", orgId)
      .single();
    internalOrgId = org?.id ?? null;
    const parsedInstallationId = Number(org?.githubinstallationid);
    githubInstallationId =
      Number.isFinite(parsedInstallationId) && parsedInstallationId > 0
        ? parsedInstallationId
        : null;
  }

  const projectId = randomUUID();

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      id: projectId,
      orgid: internalOrgId,
      ownerid: user.id,
      repofullname: repoFullName,
      repourl: repoUrl,
      defaultbranch: defaultBranch,
      indexstatus: "pending",
      githubinstallationid: githubInstallationId,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create project:", error);
    return new Response("Failed to create project", { status: 500 });
  }

  return Response.json({ project: mapProject(project) });
}
