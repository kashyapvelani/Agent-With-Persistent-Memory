import { auth } from "@clerk/nextjs/server";
import { Sandbox } from "e2b";

/** Keep sandbox alive for 15 more minutes on every health check. */
const KEEP_ALIVE_MS = 15 * 60 * 1000;

/**
 * GET /api/sandbox/status?sandboxId=...
 *
 * Health check + keep-alive. Connects to the sandbox, extends its timeout,
 * and returns { alive: true } or { alive: false }.
 */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const sandboxId = url.searchParams.get("sandboxId");

  if (!sandboxId) {
    return Response.json({ alive: false, reason: "No sandboxId" });
  }

  try {
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY,
    });
    // Extend timeout so the sandbox stays alive while the user is reviewing
    await sandbox.setTimeout(KEEP_ALIVE_MS);
    return Response.json({ alive: true });
  } catch {
    return Response.json({ alive: false, reason: "Sandbox expired or unreachable" });
  }
}
