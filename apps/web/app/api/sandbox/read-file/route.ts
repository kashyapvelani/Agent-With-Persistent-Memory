import { auth } from "@clerk/nextjs/server";
import { Sandbox } from "e2b";

/**
 * GET /api/sandbox/read-file?sandboxId=...&path=...
 *
 * Reads a file from an E2B sandbox. Used by the editor to fetch
 * file contents when a user clicks on a filename in the chat.
 */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const sandboxId = url.searchParams.get("sandboxId");
  const filePath = url.searchParams.get("path");

  if (!sandboxId || !filePath) {
    return Response.json(
      { error: "Missing sandboxId or path query parameter" },
      { status: 400 },
    );
  }

  try {
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY,
    });
    const content = await sandbox.files.read(filePath);
    return Response.json({ content, path: filePath });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes("not found") || message.includes("No such file")) {
      return Response.json(
        { error: `File not found: ${filePath}` },
        { status: 404 },
      );
    }

    if (message.includes("expired") || message.includes("not running")) {
      return Response.json(
        { error: "Sandbox has expired or is not running" },
        { status: 410 },
      );
    }

    console.error("[sandbox/read-file] Error:", message);
    return Response.json(
      { error: `Failed to read file: ${message}` },
      { status: 500 },
    );
  }
}
