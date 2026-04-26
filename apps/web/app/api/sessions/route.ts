import { auth } from "@clerk/nextjs/server";
import { createSupabaseServiceRoleClient } from "@workspace/db";
import { randomUUID } from "crypto";
import type { Session } from "@workspace/types";

const supabase = createSupabaseServiceRoleClient({
  url: process.env.SUPABASE_URL!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSession(row: any): Session {
  return {
    id: row.id,
    projectId: row.projectid,
    userId: row.userid,
    langgraphThreadId: row.langgraphthreadid ?? null,
    title: row.title ?? null,
    createdAt: row.createdat,
    updatedAt: row.updatedat,
  };
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return new Response("Missing projectId", { status: 400 });
  }

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("clerkid", userId)
    .single();

  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("projectid", projectId)
    .eq("userid", user.id)
    .order("updatedat", { ascending: false });

  if (error) {
    console.error("Failed to fetch sessions:", error);
    return new Response("Failed to fetch sessions", { status: 500 });
  }

  return Response.json((sessions ?? []).map(mapSession));
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const { projectId, langgraphThreadId: providedThreadId } = body as {
    projectId: string;
    langgraphThreadId?: string;
  };

  if (!projectId) {
    return new Response("Missing projectId", { status: 400 });
  }

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("clerkid", userId)
    .single();

  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  const langgraphThreadId = providedThreadId ?? null;
  if (!langgraphThreadId) {
    return new Response("Missing langgraphThreadId", { status: 400 });
  }

  const sessionId = randomUUID();
  const now = new Date().toISOString();

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      id: sessionId,
      projectid: projectId,
      userid: user.id,
      langgraphthreadid: langgraphThreadId,
      title: null,
      createdat: now,
      updatedat: now,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create session:", error);
    return new Response("Failed to create session", { status: 500 });
  }

  return Response.json({ session: mapSession(session) });
}
