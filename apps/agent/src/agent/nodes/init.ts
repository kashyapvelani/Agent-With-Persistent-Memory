import OpenAI from "openai";
import { createSupabaseServiceRoleClient } from "@workspace/db";
import { createQdrantClient } from "@workspace/qdrant";
import { buildAlwaysOnMemory, surfaceRelevantMemories } from "@workspace/memory";
import { getOrCreateSandbox } from "../../sandbox/manager.js";
import { getGitHubToken } from "../utils/github-token.js";
import type { AgentStateType } from "../state.js";

/**
 * initNode — Zero LLM calls. Pure setup.
 *
 * 1. Loads always-on memory (conventions + architecture)
 * 2. Runs proactive memory surfacing (embedding search, no LLM)
 * 3. Gets or creates E2B sandbox with the repo cloned
 * 4. Returns state with memory context and sandbox ready
 */
export async function initNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const supabase = createSupabaseServiceRoleClient({
    url: process.env.SUPABASE_URL!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const qdrant = createQdrantClient(
    process.env.QDRANT_URL!,
    process.env.QDRANT_API_KEY
  );

  // ── 1. Load always-on memory ───────────────────────────────────────────────
  let alwaysOnMemory = "";
  try {
    alwaysOnMemory = await buildAlwaysOnMemory(supabase, state.projectId);
  } catch (err) {
    console.warn("[initNode] Failed to build always-on memory:", err);
  }

  // ── 2. Proactive memory surfacing ──────────────────────────────────────────
  let surfacedMemories = "";
  try {
    // Extract the latest human message text
    const lastHuman = [...state.messages]
      .reverse()
      .find((m) => m._getType() === "human");
    const userMessage =
      typeof lastHuman?.content === "string"
        ? lastHuman.content
        : "";

    if (userMessage) {
      surfacedMemories = await surfaceRelevantMemories(
        qdrant,
        openai,
        state.projectId,
        userMessage
      );
    }
  } catch (err) {
    console.warn("[initNode] Failed to surface memories:", err);
  }

  // ── 3. Get or create sandbox ───────────────────────────────────────────────
  // Sandbox is CRITICAL — the agent cannot explore or edit code without it.
  // Errors here must propagate so the user sees them (not silently swallowed).
  let sandboxId = state.sandboxId;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("repofullname, githubinstallationid")
    .eq("id", state.projectId)
    .single();

  if (projectError) {
    throw new Error(
      `[initNode] Cannot find project "${state.projectId}": ${projectError.message}`
    );
  }

  if (!project?.repofullname) {
    throw new Error(
      `[initNode] Project "${state.projectId}" has no repository linked (repofullname is null). ` +
      `Connect a GitHub repository to this project first.`
    );
  }

  const githubToken = await getGitHubToken(
    project.githubinstallationid as number | null,
    supabase
  );
  const { sandboxId: newId } = await getOrCreateSandbox(
    sandboxId,
    githubToken,
    project.repofullname as string
  );
  sandboxId = newId;
  console.log("[initNode] Sandbox ready:", sandboxId);

  return {
    alwaysOnMemory,
    surfacedMemories,
    sandboxId,
    iterationCount: 0,
    finished: false,
    generatedDiffs: [],
  };
}
