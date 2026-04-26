import { auth } from "@clerk/nextjs/server";
import { createSupabaseServiceRoleClient } from "@workspace/db";

const supabase = createSupabaseServiceRoleClient({
  url: process.env.SUPABASE_URL!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
});

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { sessionId } = await params;
  if (!sessionId) {
    return new Response("Missing sessionId", { status: 400 });
  }

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("clerkid", userId)
    .single();

  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId)
    .eq("userid", user.id);

  if (error) {
    console.error("Failed to delete session:", error);
    return new Response("Failed to delete session", { status: 500 });
  }

  return new Response(null, { status: 204 });
}
