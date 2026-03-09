import { auth } from "@clerk/nextjs/server";
import { createSupabaseServiceRoleClient } from "@workspace/db";

const supabase = createSupabaseServiceRoleClient({
  url: process.env.SUPABASE_URL!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: projectId } = await params;

  // Get project status
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("indexstatus")
    .eq("id", projectId)
    .single();

  if (projErr || !project) {
    return new Response("Project not found", { status: 404 });
  }

  // Get latest indexing job for this project
  const { data: job } = await supabase
    .from("indexingjobs")
    .select("*")
    .eq("projectid", projectId)
    .order("createdat", { ascending: false })
    .limit(1)
    .single();

  return Response.json({
    indexstatus: project.indexstatus,
    indexedfiles: job?.indexedfiles ?? 0,
    totalfiles: job?.totalfiles ?? null,
    currentfile: job?.currentfile ?? null,
    jobstatus: job?.status ?? null,
    error: job?.error ?? null,
  });
}
