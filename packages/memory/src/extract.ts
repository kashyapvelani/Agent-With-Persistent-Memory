import type Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import type { TypedSupabaseClient } from "@workspace/db";
import type { QdrantClient } from "@qdrant/js-client-rest";
import { upsertDecision, ensureDecisionCollection } from "@workspace/qdrant";
import type {
  FileDiff,
  ProjectConventionsPayload,
  DecisionRecordPayload,
} from "@workspace/types";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

export interface ExtractMemoryInput {
  supabase: TypedSupabaseClient;
  anthropic: Anthropic;
  openai: OpenAI;
  qdrant: QdrantClient;
  projectId: string;
  orgId: string;
  sessionId: string;
  goal: string;
  diffs: FileDiff[];
  conversationHistory: { role: "human" | "ai"; content: string }[];
  prUrl?: string;
}

/**
 * Runs the full memory extraction pipeline after a PR is created.
 * Extracts conventions delta, inserts a decision record, and updates
 * file evolution counters. Called asynchronously — does not block the user.
 */
export async function extractMemoryFromPR(
  input: ExtractMemoryInput
): Promise<void> {
  const diffsText = input.diffs
    .map((d) => `--- ${d.file} ---\n${d.patch}`)
    .join("\n\n");
  const filesModified = input.diffs.map((d) => d.file);

  await Promise.all([
    extractAndUpdateConventions(input, diffsText),
    extractAndInsertDecision(input, diffsText, filesModified),
    updateFileEvolution(input, filesModified),
  ]);
}

// ── Conventions extraction ────────────────────────────────────────────────────

async function extractAndUpdateConventions(
  input: ExtractMemoryInput,
  diffsText: string
): Promise<void> {
  const { anthropic, supabase, projectId, orgId } = input;

  const response = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 1024,
    system:
      "Extract coding conventions from this PR diff. Return JSON only with these optional fields: " +
      '{ "namingStyle": string, "apiPattern": string, "errorPattern": string, "testingFramework": string, ' +
      '"logging": string, "preferredLibraries": string[], "fileStructure": string }. ' +
      "Only include fields you can confidently infer. Return {} if nothing notable.",
    messages: [{ role: "user", content: `PR diffs:\n${diffsText}` }],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "{}";
  let delta: Partial<ProjectConventionsPayload> = {};
  try {
    delta = JSON.parse(text) as Partial<ProjectConventionsPayload>;
  } catch {
    return;
  }
  if (Object.keys(delta).length === 0) return;

  const { data: existing } = await supabase
    .from("projectConventions")
    .select("id, conventions")
    .eq("projectId", projectId)
    .maybeSingle();

  if (existing) {
    // Spread existing (complete) first, then overlay delta — result is always a full payload
    const merged: ProjectConventionsPayload = {
      ...existing.conventions,
      ...delta,
      prCount: (existing.conventions.prCount ?? 0) + 1,
    };
    await supabase
      .from("projectConventions")
      .update({ conventions: merged, lastUpdatedAt: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    // Fill all required fields with empty defaults; delta overrides where present
    const conventions: ProjectConventionsPayload = {
      namingStyle: delta.namingStyle ?? "",
      apiPattern: delta.apiPattern ?? "",
      errorPattern: delta.errorPattern ?? "",
      testingFramework: delta.testingFramework ?? "",
      logging: delta.logging ?? "",
      preferredLibraries: delta.preferredLibraries ?? [],
      fileStructure: delta.fileStructure ?? "",
      prCount: 1,
    };
    await supabase.from("projectConventions").insert({
      id: crypto.randomUUID(),
      projectId,
      orgId,
      conventions,
    });
  }
}

// ── Decision extraction ───────────────────────────────────────────────────────

async function extractAndInsertDecision(
  input: ExtractMemoryInput,
  diffsText: string,
  filesModified: string[]
): Promise<void> {
  const {
    anthropic,
    openai,
    qdrant,
    supabase,
    projectId,
    orgId,
    sessionId,
    goal,
    prUrl,
    conversationHistory,
  } = input;

  const conversationText = conversationHistory
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 1024,
    system:
      "Extract the engineering decision from this PR. Return JSON only: " +
      '{ "goal": string, "approach": string, "reasoningSummary": string, ' +
      '"rejectedAlternatives": [{"approach": string, "reasonRejected": string}], "tags": string[] }',
    messages: [
      {
        role: "user",
        content: `Goal: ${goal}\n\nConversation:\n${conversationText}\n\nDiffs:\n${diffsText}`,
      },
    ],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "{}";
  let record: DecisionRecordPayload;
  try {
    record = JSON.parse(text) as DecisionRecordPayload;
  } catch {
    return;
  }

  // Embed goal + approach for semantic search
  const embRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: `${record.goal} ${record.approach}`,
  });
  const embedding = embRes.data[0]!.embedding;

  const decisionId = crypto.randomUUID();

  // Insert into Supabase
  await supabase.from("decisionLog").insert({
    id: decisionId,
    projectId,
    orgId,
    sessionId,
    prUrl: prUrl ?? null,
    goal: record.goal,
    approach: record.approach,
    reasoningSummary: record.reasoningSummary,
    rejectedAlternatives: record.rejectedAlternatives,
    filesModified,
    tags: record.tags,
    embedding,
  });

  // Upsert into Qdrant for semantic similarity search
  await ensureDecisionCollection(qdrant, projectId);
  await upsertDecision(qdrant, {
    id: decisionId,
    vector: embedding,
    payload: {
      projectId,
      orgId,
      goal: record.goal,
      approach: record.approach,
      tags: record.tags,
    },
  });
}

// ── File evolution tracking ───────────────────────────────────────────────────

async function updateFileEvolution(
  input: ExtractMemoryInput,
  filesModified: string[]
): Promise<void> {
  const { supabase, projectId } = input;
  const now = new Date().toISOString();

  for (const filePath of filesModified) {
    const { data: existing } = await supabase
      .from("fileEvolution")
      .select("id, changeCount, coChangedWith")
      .eq("projectId", projectId)
      .eq("filePath", filePath)
      .maybeSingle();

    const coChangedWith = filesModified.filter((f) => f !== filePath);

    if (existing) {
      const newChangeCount = existing.changeCount + 1;
      const merged = Array.from(
        new Set([...(existing.coChangedWith ?? []), ...coChangedWith])
      );
      await supabase
        .from("fileEvolution")
        .update({
          changeCount: newChangeCount,
          coChangedWith: merged,
          lastChangedAt: now,
          // Instability score = fraction of last 10 PRs that touched this file (capped at 1)
          instabilityScore: Math.min(newChangeCount / 10, 1.0),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("fileEvolution").insert({
        id: crypto.randomUUID(),
        projectId,
        filePath,
        changeCount: 1,
        bugFixCount: 0,
        coChangedWith,
        lastChangedAt: now,
        instabilityScore: 0.1,
      });
    }
  }
}
