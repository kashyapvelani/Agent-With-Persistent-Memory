import { auth } from "@clerk/nextjs/server";
import { createSupabaseServiceRoleClient } from "@workspace/db";
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth();

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!orgId) {
    return new Response("Project not found", { status: 404 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("clerkorgid", orgId)
    .single();

  if (!org) {
    return new Response("Project not found", { status: 404 });
  }

  const { id: projectId } = await params;

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("orgid", org.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return new Response("Project not found", { status: 404 });
    }

    console.error("Failed to fetch project:", error);
    return new Response("Failed to fetch project", { status: 500 });
  }

  if (!project) {
    return new Response("Project not found", { status: 404 });
  }

  return Response.json({ project: mapProject(project) });
}
