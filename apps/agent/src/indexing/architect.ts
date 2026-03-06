import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServiceRoleClient } from "@workspace/db";
import { randomUUID } from "crypto";
import type { TreeEntry } from "@workspace/github";
import type { ProjectArchitecturePayload } from "@workspace/types";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 1024;

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

function getSupabase() {
  return createSupabaseServiceRoleClient({
    url: process.env.SUPABASE_URL!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  });
}

function buildPrompt(repoFullName: string, tree: TreeEntry[]): string {
  // Top-level directories only
  const topDirs = [
    ...new Set(
      tree
        .filter((e) => e.type === "tree" && !e.path.includes("/"))
        .map((e) => e.path)
    ),
  ].slice(0, 30);

  // File extensions present
  const extensions = [
    ...new Set(
      tree
        .filter((e) => e.type === "blob")
        .map((e) => {
          const dot = e.path.lastIndexOf(".");
          return dot !== -1 ? e.path.slice(dot) : "";
        })
        .filter(Boolean)
    ),
  ];

  // Sample up to 30 file paths for context
  const samplePaths = tree
    .filter((e) => e.type === "blob")
    .map((e) => e.path)
    .slice(0, 30)
    .join("\n");

  return `You are analyzing a GitHub repository to extract its architectural summary.

Repository: ${repoFullName}
Top-level directories: ${topDirs.join(", ") || "(none)"}
File extensions: ${extensions.join(", ")}
Total files: ${tree.filter((e) => e.type === "blob").length}

Sample file paths:
${samplePaths}

Return JSON only — no markdown, no explanation:
{
  "layers": ["string"],
  "rules": ["string"],
  "moduleSummaries": { "dir": "one-sentence description" },
  "serviceRelationships": ["string"]
}

Only include fields you can confidently infer from the file structure.
Keep each string concise (one sentence max). Return {} if nothing can be inferred.`;
}

export async function generateArchitecturalSummary(
  projectId: string,
  orgId: string,
  repoFullName: string,
  tree: TreeEntry[]
): Promise<void> {
  const anthropic = getAnthropic();

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: buildPrompt(repoFullName, tree) }],
  });

  const raw = message.content[0]?.type === "text" ? message.content[0].text.trim() : "{}";

  let architecture: ProjectArchitecturePayload;
  try {
    architecture = JSON.parse(raw) as ProjectArchitecturePayload;
  } catch {
    architecture = { layers: [], rules: [], moduleSummaries: {}, serviceRelationships: [] };
  }

  const supabase = getSupabase();

  await supabase.from("projectArchitecture").upsert(
    {
      id: randomUUID(),
      projectId,
      orgId,
      architecture,
      lastUpdatedAt: new Date().toISOString(),
    },
    { onConflict: "projectid" }
  );
}
