# Product Spec: NexGenesis — AI Coding Agent with Evolutionary Memory
> Implementation-ready spec for Codex
> Version: 1.0 MVP

---

## 1. Product Overview

NexGenesis is the first AI coding agent that builds **long-term project intelligence**. Unlike tools that forget after every session, NexGenesis accumulates knowledge across every PR, every bug fix, and every architectural decision — becoming more aligned with your team over time.

It connects to your GitHub repository, indexes your codebase, and learns your project's conventions, architecture, and decision history. The longer you use it, the smarter it gets about *your specific project*.

**The core promise:**
- After 2 PRs → adapts to your naming style and coding conventions
- After 5 bugs → warns about recurring mistake patterns
- After 10 tasks → understands your service boundaries and enforces them

**Memory must:**
1. Accumulate across tasks
2. Influence future code generation
3. Be inspectable by users
4. Be editable by users
5. Improve correctness and alignment over time

If it doesn't influence future output, it's not memory — it's storage.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo (TypeScript throughout) |
| Frontend | Next.js 16 (App Router), shadcn/ui, Tailwind CSS, AI SDK Elements (customized core components to use with `useStream` hook) |
| Frontend Hosting | Railway (custom domain) |
| Auth | Clerk (GitHub OAuth, Organizations, RBAC) |
| Agent Framework | LangGraph.js (TypeScript) |
| Agent Hosting | LangSmith (LangGraph Cloud) |
| Agent↔Frontend | `@langchain/langgraph-sdk` `useStream()` hook |
| LLM — Agent Loop | Claude Sonnet 4.6 (single agentic loop — planning, coding, review, QA) |
| LLM — Memory Extraction | Claude Haiku 4.5 (async — session summaries, convention/decision extraction) |
| LLM — Context Compaction | Claude Haiku 4.5 (auto-triggered at ~80K tokens) |
| Embeddings | text-embedding-3-small (OpenAI) |
| Primary Database | Supabase (Postgres + Realtime + Storage) |
| Vector Database | Qdrant (Railway Docker) — code chunks + memory search |
| Sandbox | E2B (all tasks — snippets, single-file, multi-file, full repo) |
| CI/CD | GitHub Actions |

> **Note:** Neo4j removed for MVP. Code relationship intelligence is handled via lightweight architectural summaries stored in Supabase + semantic search in Qdrant. Agent v2 uses a single Claude Sonnet 4.6 model for the agentic loop — no classifier, no separate planner/coder/reviewer models.

---

## 3. Monorepo Structure

```
/
├── apps/
│   ├── web/                        # Next.js 16 frontend
│   └── agent/                      # LangGraph.js agent (TypeScript)
├── packages/
│   ├── ui/                         # Shared shadcn/ui components
│   ├── db/                         # Supabase client + schema + migrations
│   ├── types/                      # Shared TypeScript types/interfaces
│   ├── qdrant/                     # Qdrant client + embedding utilities
│   ├── memory/                     # Memory extraction, storage, injection logic
│   └── github/                     # GitHub API client (Octokit wrapper)
├── turbo.json
├── package.json
└── .github/
    └── workflows/
        ├── ci.yml
        └── deploy.yml
```

---

## 4. Core User Flows

### 4.1 Authentication & Onboarding
1. User visits the app → clicks "Sign in with GitHub" → Clerk GitHub OAuth
2. User **must** create or join an **Organization** (compulsory — even for solo users)
3. Organization members share the same project index, memory, and decision history
4. After login → redirect to `/dashboard`

### 4.2 Project Creation
1. User clicks "New Project" → two options:
   - **Connect existing GitHub repo** — select from GitHub repos list (via OAuth token)
   - **Start from scratch** — NexGenesis creates an empty repo on their GitHub account via GitHub API, no manual repo creation needed
2. System checks Supabase: does an index already exist for this repo + org?
   - **Existing index** → show last indexed timestamp + "Re-index" option → skip to workspace
   - **New repo** → start indexing pipeline
3. Indexing pipeline runs (see Section 6) — frontend shows real-time progress using ` supabase realtime`
4. On completion → redirect to `/projects/[projectId]`

### 4.3 Project Workspace
The workspace is the primary screen (use `Allotment` library for resizable panels):
- **Left panel:** Tasks
- **Center panel:** Chat interface with the agent (streaming via `useStream()`)
- **Right panel:** Code diff viewer / file preview (CodeMirror Editor)
- **Top bar:** Branch selector, "Create PR" button, Re-index button, Project Memory button

### 4.4 Agent Interaction Flow

User sends a message → a single agentic loop handles everything (no classifier):

| Scenario | Agent Behavior | LLM Calls | Sandbox? |
|---|---|---|---|
| Greeting / simple question | Responds directly, no tools | 1 | No |
| Code Q&A / search | Uses `recall_memory` + `search_code` tools | 1-2 | Optional |
| Single line/file fix | Reads file → edits → verifies | 2-3 | E2B |
| New feature / multi-step | Creates plan → `interrupt()` for approval → executes steps → review | N+2 | E2B |
| Bug fix (multi-file) | Reads → plans → edits → runs tests → iterates | 3-5 | E2B |

**Modes:**
- **Auto mode (default):** Full tool access. Agent decides whether to plan, explore, or edit directly.
- **Plan mode:** User toggles "Plan" in the UI. Agent gets read-only tools only until it creates a plan and calls `request_plan_approval` → `interrupt()`. After user approval, mode auto-switches to "auto" with full write access.

**Memory is always available:** Conventions + architecture are injected as always-on memory in the system prompt. Relevant past decisions and session summaries are proactively surfaced via embedding search (>0.85 threshold). The agent can also actively call `recall_memory` to search for specific past context.

### 4.5 PR Creation & Memory Capture
1. User reviews generated diffs in the right panel
2. Clicks "Create Branch & PR" button
3. System:
   - Creates branch: `nexgenesis/[short-description]-[timestamp]`
   - Commits the generated diffs via GitHub API
   - Opens a PR with auto-generated title + description
4. PR URL shown in UI with direct GitHub link
5. **Memory extraction pipeline triggers asynchronously** (see Section 7.2):
   - Extracts conventions, decisions, patterns from this PR
   - Updates project memory in Supabase
   - User can review/edit extracted memory in the Memory Panel

---

## 5. Database Schema (Supabase)

```sql
-- Users synced from Clerk
CREATE TABLE users (
  id UUID PRIMARY KEY,
  clerkId TEXT UNIQUE NOT NULL,
  githubUsername TEXT,
  githubAccessToken TEXT, -- encrypted
  email TEXT,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Clerk org maps to a team
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  clerkOrgId TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- A project = one indexed GitHub repo
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  orgId UUID REFERENCES organizations(id),
  ownerId UUID REFERENCES users(id),
  repoFullName TEXT NOT NULL,
  repoUrl TEXT NOT NULL,
  defaultBranch TEXT DEFAULT 'main',
  indexStatus TEXT DEFAULT 'pending', -- pending | indexing | ready | failed
  lastIndexedAt TIMESTAMPTZ,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Agent conversation sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  projectId UUID REFERENCES projects(id),
  userId UUID REFERENCES users(id),
  langgraphThreadId TEXT UNIQUE,
  title TEXT,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Messages stored per session
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  sessionId UUID REFERENCES sessions(id),
  role TEXT NOT NULL, -- user | assistant | tool
  content TEXT NOT NULL,
  metadata JSONB, -- tool calls, file refs, diff, etc.
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Generated code waiting for PR
CREATE TABLE pendingChanges (
  id UUID PRIMARY KEY,
  sessionId UUID REFERENCES sessions(id),
  projectId UUID REFERENCES projects(id),
  diffs JSONB NOT NULL, -- array of {file, patch}
  prUrl TEXT,
  status TEXT DEFAULT 'pending', -- pending | pr_created
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing job progress (for realtime updates)
CREATE TABLE indexingJobs (
  id UUID PRIMARY KEY,
  projectId UUID REFERENCES projects(id),
  status TEXT DEFAULT 'running', -- running | complete | failed
  totalFiles INT,
  indexedFiles INT DEFAULT 0,
  currentFile TEXT,
  error TEXT,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- EVOLUTIONARY MEMORY TABLES
-- ─────────────────────────────────────────

-- Layer 1: Project Conventions Memory
-- Extracted from accepted PRs. Injected into PlannerNode/CoderNode system prompt.
CREATE TABLE projectConventions (
  id UUID PRIMARY KEY,
  projectId UUID REFERENCES projects(id),
  orgId UUID REFERENCES organizations(id),
  conventions JSONB NOT NULL,
  -- Shape: {
  --   namingStyle: string,
  --   apiPattern: string,
  --   errorPattern: string,
  --   testingFramework: string,
  --   logging: string,
  --   preferredLibraries: string[],
  --   fileStructure: string,
  --   prCount: number  -- how many PRs this was learned from
  -- }
  lastUpdatedAt TIMESTAMPTZ DEFAULT NOW(),
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Layer 2: Architectural Memory
-- Generated once after indexing, updated after significant PRs.
CREATE TABLE projectArchitecture (
  id UUID PRIMARY KEY,
  projectId UUID REFERENCES projects(id),
  orgId UUID REFERENCES organizations(id),
  architecture JSONB NOT NULL,
  -- Shape: {
  --   layers: string[],              e.g. ["controllers","services","repositories"]
  --   rules: string[],               e.g. ["controllers must not access DB directly"]
  --   moduleSummaries: {
  --     [moduleName]: string        e.g. "auth/": "handles JWT + session management"
  --   },
  --   serviceRelationships: string[] e.g. ["UserService depends on EmailService"]
  -- }
  lastUpdatedAt TIMESTAMPTZ DEFAULT NOW(),
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Layer 3: Decision Memory (The Moat)
-- One row per PR. Stores the why behind every change.
CREATE TABLE decisionLog (
  id UUID PRIMARY KEY,
  projectId UUID REFERENCES projects(id),
  orgId UUID REFERENCES organizations(id),
  sessionId UUID REFERENCES sessions(id),
  prUrl TEXT,
  goal TEXT NOT NULL,              -- "Add rate limiting to API"
  approach TEXT NOT NULL,          -- "Middleware-based rate limiter using Redis"
  reasoningSummary TEXT NOT NULL, -- "Chosen to avoid modifying individual controllers"
  rejectedAlternatives JSONB,     -- [{ approach: string, reason_rejected: string }]
  filesModified TEXT[],
  tags TEXT[],                     -- ["performance", "api", "redis"] for retrieval
  embedding VECTOR(1536),          -- embedded goal+approach for semantic search
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Layer 4: Evolution Tracking
-- Tracks which files change together, recurring bugs, unstable modules.
CREATE TABLE fileEvolution (
  id UUID PRIMARY KEY,
  projectId UUID REFERENCES projects(id),
  filePath TEXT NOT NULL,
  changeCount INT DEFAULT 0,
  bugFixCount INT DEFAULT 0,     -- how many times this file was in a bug fix PR
  coChangedWith TEXT[],          -- files that frequently change together
  lastChangedAt TIMESTAMPTZ,
  instabilityScore FLOAT DEFAULT 0, -- higher = more frequently changed = more unstable
  UNIQUE(projectId, file_path)
);

-- Layer 5: Session Summaries (Agent v2 — long-term session recall)
-- Generated by Haiku after each session ends. Embedded for semantic search.
CREATE TABLE sessionSummaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projectId UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  orgId UUID NOT NULL,
  sessionId UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  topics TEXT[] DEFAULT '{}',
  decisionsReferenced UUID[] DEFAULT '{}',
  embedding FLOAT8[],
  createdAt TIMESTAMPTZ DEFAULT now(),
  UNIQUE (sessionId)
);

-- Memory edits by users (audit trail of manual corrections)
CREATE TABLE memoryEdits (
  id UUID PRIMARY KEY,
  projectId UUID REFERENCES projects(id),
  userId UUID REFERENCES users(id),
  memoryType TEXT NOT NULL, -- conventions | architecture | decision
  memoryId UUID NOT NULL,   -- references the edited row
  before JSONB,
  after JSONB,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);
```

> **Note:** The `decisionLog` table also has `importance FLOAT8 DEFAULT 0.5` and `lastReferencedAt TIMESTAMPTZ` columns (added in migration 0006) for ranking recalled memories by importance and recency.

---

## 6. Indexing Pipeline

Triggered when a new project is created or user clicks "Re-index".

### Steps
```
1. Clone repo via GitHub API (sparse checkout for large repos)
2. Walk file tree → filter out: node_modules, .git, dist, build, *.lock files
3. For each file:
   a. Detect language (tree-sitter language detection)
   b. Parse AST using tree-sitter (TS, JS, Python bindings for MVP)
   c. Chunk by AST node: extract functions, classes, interfaces, modules
   d. Generate embedding: text-embedding-3-small per chunk
   e. Upsert into Qdrant (collection: {orgId}_{projectId})
      Payload: { filePath, language, nodeType, nodeName, repo, orgId, projectId }
4. Generate initial architectural summary (Claude Haiku 4.5):
   - Analyze directory structure + top-level module names
   - Identify layers, service relationships, domain areas
   - Write to projectArchitecture table
5. Update indexingJobs row → Supabase Realtime pushes progress to frontend
6. On completion: projects.indexStatus = 'ready', lastIndexedAt = NOW()
```

### Re-indexing (Incremental)
- Fetch git diff since `lastIndexedAt`
- Re-embed only changed/added files
- Delete removed files from Qdrant
- Re-run architectural summary generation if >20% of files changed
- Never re-embed unchanged files (cost saving)

---

## 7. Evolutionary Memory System (v2 — Hierarchical Memory + Active Recall)

The memory system solves the **context window problem**: a user may have a year of memories (decisions, architecture evolution, conventions) and expect the agent to recall something discussed 8 months ago — all within a 128K token limit.

### 7.1 Hierarchical Memory Layers

| Layer | Source | Token Budget | Loaded When |
|---|---|---|---|
| **Always-On** | `projectConventions` + `projectArchitecture` | ~2-3K | Every turn (system prompt) |
| **Proactive Surfacing** | Qdrant decisions + sessions (>0.85 threshold) | ~1-2K | Every turn (initNode, no LLM) |
| **Active Recall** | Agent calls `recall_memory` tool | ~2-4K per call | On demand (agent decides) |
| **Conversation History** | LangGraph messages | ~80K (auto-compacted) | Every turn |
| **Tool Outputs** | File reads, search results | ~30K | Current iteration |

**Total context budget: ~128K with ~10K headroom.**

### 7.2 Always-On Memory (Layer 1)

```typescript
// packages/memory/src/inject.ts
async function buildAlwaysOnMemory(supabase, projectId): Promise<string> {
  const [conventions, architecture] = await Promise.all([
    getProjectConventions(projectId),
    getProjectArchitecture(projectId),
  ]);
  // Returns formatted "## Project Intelligence" block
  // Conventions + architecture only — NO decisions search (moved to recall_memory tool)
}
```

Injected into the system prompt every turn. Compact (~2-3K tokens). Like CLAUDE.md — always present.

### 7.3 Proactive Memory Surfacing (Layer 2 — No LLM Call)

On each user message, `initNode` does:
1. Embed the user's message (1 cheap OpenAI embedding call)
2. Search Qdrant `decisions_{projectId}` + `sessions_{projectId}` with high threshold (>0.85)
3. If matches found → inject as "Relevant context from project history" in system prompt

This handles the "randomly remembers something relevant" case without any LLM call.

### 7.4 Active Recall via `recall_memory` Tool (Layer 3)

The agent has a `recall_memory` tool it actively calls when the user references past work:

```
User: "Remember when we discussed switching from REST to GraphQL for the dashboard?"

Agent thinks: I should search for this past discussion.
Agent calls: recall_memory({
  queries: [
    "switching REST to GraphQL dashboard",
    "API architecture decision dashboard service",
    "GraphQL migration discussion"
  ]
})

→ Batch-embeds all queries
→ Searches BOTH decisions + session summaries in Qdrant
→ Deduplicates, sorts by score
→ Returns top 5 decisions + 3 session summaries
→ Agent uses this context in its response
```

**Why this works:** The LLM generates the retrieval queries, not the user. It can expand implicit references into explicit search terms. Multiple diverse queries cover different angles.

### 7.5 Session Summaries (NEW — Long-Term Session Recall)

After each session ends, `memoryExtractorNode` generates a summary:

```
Session Summary Pipeline:
  └──▶ generateSessionSummary (Claude Haiku 4.5)
         ├──▶ Summarize: topics discussed, decisions made, key context
         ├──▶ Embed summary via text-embedding-3-small
         ├──▶ Store in Supabase `sessionSummaries` table
         └──▶ Store in Qdrant `sessions_{projectId}` collection
```

This is how the agent finds "what we discussed 8 months ago" — session summaries are searchable via both `recall_memory` and proactive surfacing.

**Qdrant collection:** `sessions_{projectId}` — vector size 1536, cosine distance. Payload: `{ projectId, orgId, sessionId, summary, topics, createdAt }`.

### 7.6 Memory Extraction Pipeline (After Task Completion)

Runs **asynchronously** after the agent finishes. Does not block the user.

```
Agent finishes task
  └──▶ memoryExtractorNode (Claude Haiku 4.5)
         ├──▶ If diffs exist:
         │      ├──▶ Extract conventions delta → upsert projectConventions
         │      ├──▶ Extract decision record → insert decisionLog + embed in Qdrant
         │      ├──▶ Update fileEvolution counts
         │      └──▶ Refresh projectArchitecture if structural change detected
         └──▶ Always (if conversation >= 2 messages):
                └──▶ Generate session summary → store in Supabase + Qdrant
```

### 7.7 Context Compaction

When conversation messages exceed ~80K tokens:
1. Take oldest 60% of messages
2. Summarize with Haiku (~$0.001 cost): preserve all decisions, files changed, outstanding tasks
3. Use `RemoveMessage` ops to remove old messages from LangGraph state properly
4. Replace with a single summary `SystemMessage`
5. Keep recent 40% intact

### 7.8 Memory Layers Summary

| Layer | Table / Collection | Updated When | Used When |
|---|---|---|---|
| **Conventions** | `projectConventions` | After every task with diffs | Always-on (system prompt) |
| **Architecture** | `projectArchitecture` | After indexing + major changes | Always-on (system prompt) |
| **Session Summaries** | `sessionSummaries` + Qdrant `sessions_{projectId}` | After every session | Proactive surfacing + `recall_memory` |
| **Decisions** | `decisionLog` + Qdrant `decisions_{projectId}` | After every task with diffs | Proactive surfacing + `recall_memory` |
| **Evolution** | `fileEvolution` | After every task with diffs | Risk warnings, instability hints |

### 7.9 Evolution Tracking — Instability Warnings

When `fileEvolution.instabilityScore > 0.7` (changed in >70% of recent PRs):

```
⚠️ Warning: `src/services/PaymentService.ts` has been modified in 8 of the
last 10 tasks. This may indicate instability or unclear responsibility boundaries.
```

This surfaces in the PlanTimeline UI component before execution starts.

---

## 8. LangGraph Agent Architecture (v2 — Single Agentic Loop)

The agent uses a **single agentic loop** inspired by Claude Code: one agent node with tools that gathers context, takes action, verifies results, and iterates. This replaces the previous 7-node pipeline (Classifier → QA/Planner → Coder → Executor → Reviewer → MemoryExtractor) with 3 nodes.

### Graph Definition

```
START → initNode → agentLoop ⟷ shouldContinue → memoryExtract → END
```

```typescript
// apps/agent/src/agent/graph.ts
function shouldContinue(state): "agentLoop" | "memoryExtract" {
  if (state.finished) return "memoryExtract";
  if (state.iterationCount >= 50) return "memoryExtract";
  return "agentLoop";  // continue looping
}

const builder = new StateGraph(AgentStateAnnotation)
  .addNode("init", initNode)
  .addNode("agentLoop", agentLoopNode)
  .addNode("memoryExtract", memoryExtractorNode)
  .addEdge(START, "init")
  .addEdge("init", "agentLoop")
  .addConditionalEdges("agentLoop", shouldContinue, {
    agentLoop: "agentLoop",
    memoryExtract: "memoryExtract",
  })
  .addEdge("memoryExtract", END);
```

**Why per-iteration node (not while-loop inside):** LangGraph checkpoints between node executions. Each iteration as a separate graph step gives: resume after server restart, interrupt/resume works naturally, time-travel debugging, stream progress to frontend per iteration.

### Node Responsibilities

**initNode — Zero LLM calls. Pure setup.**
- Loads always-on memory via `buildAlwaysOnMemory` (conventions + architecture)
- Runs proactive memory surfacing via `surfaceRelevantMemories` (embedding search, no LLM)
- Gets or creates E2B sandbox with the repo cloned
- Returns state with memory context and sandbox ready

**agentLoopNode — THE core node. Single Claude Sonnet 4.6 call per iteration.**
- Runs context compaction if messages exceed ~80K tokens
- Builds tool set based on mode (read-only for plan mode pre-approval, full for auto)
- System prompt = base instructions + plan mode directive (if applicable) + alwaysOnMemory + surfacedMemories
- Processes ONE model response per iteration, executes all tool calls
- If no tool calls → marks as finished (simple QA/greeting = 1 LLM call total)
- Graph re-enters via `shouldContinue` conditional edge

**memoryExtractorNode — Async, fire-and-forget.**
- Runs both `extractMemoryFromPR` (when diffs exist) AND `generateSessionSummary` (always) in parallel
- Extracts conventions, decisions, file evolution from code changes
- Generates session summary for long-term recall
- Emits `memoryUpdated` custom event → frontend shows toast

### Tool Set

**Read-Only Tools (available in ALL modes)**

| Tool | Description |
|------|-------------|
| `read_file` | Read file from sandbox (truncates >500 lines) |
| `list_directory` | List directory entries |
| `glob` | Find files by pattern |
| `search_files` | Grep across files |
| `recall_memory` | **NEW** — Multi-query memory search across decisions + session summaries |
| `search_code` | **NEW** — Semantic code search via Qdrant embeddings |

**Write Tools (auto mode only, or plan mode after approval)**

| Tool | Description |
|------|-------------|
| `write_file` | Create or overwrite file |
| `edit_file` | Precise find-replace (preferred for edits) |
| `delete_file` | Remove file |
| `run_command` | Run shell command (2-min timeout, output capped at 5000 chars) |

**Control Flow Tools (available in ALL modes)**

| Tool | Description |
|------|-------------|
| `create_plan` | Structure PlanStep[], dispatch `plan_step_update` event |
| `update_plan_step` | Mark step in_progress/completed/failed, dispatch event |
| `request_plan_approval` | Present plan, trigger `interrupt()`, auto-switch to "auto" after approval |
| `request_review_approval` | Capture git diff, present for review, trigger `interrupt()` |
| `finish` | Signal task completion, capture final diffs |

### Interrupts

**Plan approval (plan mode):**
`interrupt({ type: "plan_approval", plan })` — frontend resumes with:
- `{ action: "approve" }` or `{ action: "edit", editedPlan: PlanStep[] }`

**Review approval (after code changes):**
`interrupt({ type: "review_result", diffs })` — frontend resumes with:
- `{ action: "approve" }` or `{ action: "reject", feedback: string }`

### Agent State Shape (v2)

```typescript
// apps/agent/src/agent/state.ts
const AgentStateAnnotation = Annotation.Root({
  messages:       BaseMessage[]       // messagesStateReducer (append, not replace)
  sessionId:      string
  projectId:      string
  orgId:          string
  mode:           "plan" | "auto"     // user-toggled, auto-switches after plan approval
  sandboxId:      string | null       // E2B sandbox reused across iterations
  alwaysOnMemory: string              // conventions + architecture (compact, ~2-3K tokens)
  surfacedMemories: string            // proactively surfaced high-confidence matches
  iterationCount: number              // loop counter (max 50)
  finished:       boolean             // set by finish() tool or no-tool-call response
  generatedDiffs: FileDiff[]          // captured at end via git diff
  plan:           PlanStep[] | null   // optional, created by agent via create_plan
  memoryExtractionStatus: string | null
});
```

**Removed from v1:** `taskType` (no classifier), `currentStepIndex` (agent manages itself), `retrievedChunks` (in tool messages), `memoryContext` (split into `alwaysOnMemory` + `surfacedMemories`), `executionResult` (in tool messages), `reviewResult` (in tool messages), `retryCount` (replaced by `iterationCount`).

### Cost Comparison (v1 → v2)

| Task | v1 (LLM calls) | v2 (LLM calls) | Savings |
|------|-----------------|-----------------|---------|
| "Hi" / greeting | 2 (classify + QA) | 1 (direct response) | 50% |
| "Where is X?" | 2 (classify + QA) | 1 (search + respond) | 50% |
| Rename a variable | 4+ (classify + code + exec + review) | 2-3 (read + edit + verify) | 25-50% |
| Multi-file feature | 5+N (classify + plan + N code + exec + review) | N+2 (plan + N edits + verify) | ~30% |
| "Remember when we..." | 2 (classify + QA, often misses) | 1-2 (recall_memory + respond) | Better quality |

---

## 9. Frontend Pages & Components

```
/                               Landing page (Marketing)
/sign-in                        Clerk sign-in
/sign-up                        Clerk sign-up  
/dashboard                      All org projects
/projects/new                   Repo selector OR create from scratch
/projects/[id]                  Main agent workspace
/projects/[id]/memory           Project Memory Panel (inspect + edit)
/projects/[id]/settings         Re-index, delete project
/org/[id]/settings              Org members (future: billing)
```

### Workspace Component Tree

```
WorkspacePage  /projects/[id]   (Allotment resizable panels)
├── TopBar
│   ├── BranchSelector
│   ├── CreatePRButton
│   ├── ReIndexButton
│   └── MemoryButton            → opens /projects/[id]/memory slide-over
├── FileTreePanel               (GitHub API, click to preview)
├── ChatPanel
│   ├── MessageList             (streaming via useStream())
│   ├── PlanTimeline            (multi-step tasks, with approve/edit interrupt UI)
│   ├── InstabilityWarnings     (shown when high-churn files are involved)
│   └── ChatInput
└── DiffViewer or FilePreview                  (CodeMirror6 for Editor/diff view)
```

### Memory Panel `/projects/[id]/memory`

This is a key differentiator — users can **see and edit** what the agent has learned.

```
MemoryPanel
├── ConventionsCard             (editable JSON — naming, patterns, libraries)
├── ArchitectureCard            (editable — layers, rules, module summaries)
├── DecisionLog                 (timeline of past decisions, searchable)
│   └── DecisionCard            (goal, approach, reasoning, rejected alternatives)
└── FileEvolutionTable          (instability scores, co-change patterns)
```

### Streaming Setup

```typescript
// apps/web/hooks/useAgent.ts
import { useStream } from "@langchain/langgraph-sdk/react";

export function useAgent(threadId: string) {
  return useStream({
    apiUrl: process.env.NEXT_PUBLIC_LANGGRAPH_API_URL,
    assistantId: "nexgenesis-agent",
    threadId,
    streamMode: ["values", "messages", "custom"], // custom for memoryUpdated events
  });
}
```

---

## 10. API Routes (Next.js)

```
POST   /api/projects                     Create project, trigger indexing
GET    /api/projects                     List projects for org
GET    /api/projects/[id]                Get project + index status
POST   /api/projects/[id]/reindex        Trigger re-index
POST   /api/sessions                     Create new agent session
GET    /api/sessions/[id]                Get session + messages
POST   /api/github/repos                 List user's GitHub repos
POST   /api/github/repos/create          Create new empty repo for scratch projects
POST   /api/github/pr                    Create branch + PR from pending_changes
GET    /api/indexing/[jobId]             Get indexing job status

-- Memory endpoints
GET    /api/projects/[id]/memory                  Get all memory layers
PATCH  /api/projects/[id]/memory/conventions      Update conventions
PATCH  /api/projects/[id]/memory/architecture     Update architecture
GET    /api/projects/[id]/memory/decisions        List decision log
DELETE /api/projects/[id]/memory/decisions/[did]  Remove a decision
```

---

## 11. Environment Variables

### apps/web (.env.local)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_LANGGRAPH_API_URL=
NEXT_PUBLIC_APP_URL=
```

### apps/agent (.env)
```
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
QDRANT_URL=
QDRANT_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
E2B_API_KEY=
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
LANGSMITH_API_KEY=
COHERE_API_KEY=
```

---

## 12. GitHub Integration

- Use a **GitHub App** (not OAuth app) for fine-grained per-repo permissions
- Scopes needed: `contents:read`, `contents:write`, `pull_requests:write`, `metadata:read`
- For scratch projects: additional scope `administration:write` to create repos
- Store installation token per project in Supabase (encrypted)
- Use `@octokit/app` to generate per-installation tokens at runtime

---

## 13. Multi-Tenancy & Org Isolation

- Qdrant collections: code chunks `{orgId}_{projectId}`, decisions `decisions_{projectId}`, session summaries `sessions_{projectId}`
- All memory tables have `orgId` column — all queries filter by both `orgId` + `projectId`
- Supabase RLS: users can only read/write rows where `orgId` matches their Clerk org
- Memory is shared across org members — one team's learning benefits the whole team
- Clerk middleware on all `/api/*` routes: validate `orgId` from session token

---

## 14. MVP Phased Task List

### Phase 1 — Foundation
- [x] Init Turborepo: `apps/web`, `apps/agent`, `packages/*` (including `packages/memory`)
- [x] Set up Clerk: GitHub OAuth + Organizations (compulsory org flow)
- [x] Set up Supabase: run all schema migrations including memory tables, configure RLS
- [x] Set up Qdrant on Railway (Docker): base collections + `decisions_{projectId}` collection
- [x] GitHub App: register, OAuth install flow, store tokens, repo creation scope

### Phase 2 — Indexing Pipeline
- [x] Build tree-sitter parser for TS, JS, Python
- [x] Build AST chunker → embedding → Qdrant upsert pipeline
- [x] Build initial architectural summary generator (Claude Haiku post-index)
- [x] Realtime indexing progress via Supabase pending status.
- [x] Implement incremental re-indexing (git diff based)

### Phase 3 — Agent Core
- [x] Scaffold LangGraph.js agent in `apps/agent`
- [x] ~~v1: Implement ClassifierNode, QANode, CoderNode, ExecutorNode, ReviewerNode~~ (deprecated)
- [x] **v2: Redesign to single agentic loop** — 3 nodes replacing 7 (init → agentLoop → memoryExtract)
- [x] Implement `initNode` — always-on memory + proactive surfacing + sandbox setup
- [x] Implement `agentLoopNode` — core ReAct loop with Claude Sonnet 4.6 + all tools
- [x] Implement control flow tools: `create_plan`, `update_plan_step`, `request_plan_approval`, `request_review_approval`, `finish`
- [x] Implement memory tools: `recall_memory` (multi-query search), `search_code` (semantic)
- [x] Implement context compaction (auto-triggers at ~80K tokens, Haiku summarization)
- [x] Split sandbox tools into `buildReadOnlyTools` + `buildWriteTools` for mode enforcement
- [x] Implement plan mode (read-only tools → plan → interrupt → auto-switch)
- [x] Implement `packages/memory`: `buildAlwaysOnMemory`, `surfaceRelevantMemories`, `generateSessionSummary`
- [x] Implement session summaries pipeline (Haiku → Supabase + Qdrant `sessions_{projectId}`)
- [x] Database migration: `sessionSummaries` table + `decisionLog` enhancements (importance, lastReferencedAt)
- [x] Implement Qdrant session collection helpers (`packages/qdrant/src/sessions.ts`)
- [x] Update `memoryExtractorNode` for v2 (runs extractMemoryFromPR + generateSessionSummary in parallel)
- [x] Integrate E2B sandbox (full repo access, sandbox reused via sandboxId)
- [ ] Integrate Cohere Rerank for retrieval quality (Later)
- [ ] Implement `search_docs` tool — web documentation lookup for anti-hallucination (Later)
- [ ] Deploy agent to LangSmith

### Phase 4 — Frontend Workspace
- [ ] Build dashboard: project list, new project flow (existing + scratch), indexing progress
- [ ] Build workspace: Allotment panels, file tree, chat, diff viewer
- [ ] Wire `useStream()` with `streamMode: ["values", "messages", "custom"]`
- [ ] Build PlanTimeline component with approve/edit interrupt UI
- [ ] Build InstabilityWarnings component
- [ ] Build Memory Panel: ConventionsCard, ArchitectureCard, DecisionLog, FileEvolutionTable
- [ ] All memory cards editable (PATCH API + memory_edits audit log)
- [ ] Build PR creation flow (branch + PR via GitHub API)

### Phase 5 — Polish
- [ ] Add org member invite flow
- [ ] "Memory updated" toast on `memoryUpdated` custom events
- [ ] Instability score warnings surfaced in PlanTimeline
- [ ] Error handling, loading states, empty states throughout
- [ ] Deploy frontend + agent to Railway / LangSmith
- [ ] End-to-end testing across all flows

---

## 15. Out of Scope for MVP

- Neo4j graph DB (replaced by architectural summaries in Postgres + Qdrant)
- Billing / usage limits per org
- Support for GitLab / Bitbucket
- VS Code extension
- Slack / Teams bot
- Fine-tuned models
- Self-hosted LLM option
- Real-time collaborative editing (multiple users in same session simultaneously)
- Memory auto-sharing across organizations