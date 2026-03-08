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
| LLM — Classification | Claude Haiku 4.5 (fast, cheap) |
| LLM — Planning/Routing | GPT-5.3 (OpenAI) |
| LLM — Code Gen/Review | Claude Sonnet 4.6 (Anthropic) |
| LLM — Memory Extraction | Claude Haiku 4.5 (async, after PR merge) |
| Embeddings | text-embedding-3-small (OpenAI) |
| Primary Database | Supabase (Postgres + Realtime + Storage) |
| Vector Database | Qdrant (Railway Docker) — code chunks + memory search |
| Sandbox | E2B (all tasks — snippets, single-file, multi-file, full repo) |
| CI/CD | GitHub Actions |

> **Note:** Neo4j removed for MVP. Code relationship intelligence is handled via lightweight architectural summaries stored in Supabase + semantic search in Qdrant. Can be added in v2 for deep graph traversal.

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
- **Left panel:** File tree of the repo (fetched from GitHub API)
- **Center panel:** Chat interface with the agent (streaming via `useStream()`)
- **Right panel:** Code diff viewer / file preview (Monaco Editor)
- **Top bar:** Branch selector, "Create PR" button, Re-index button, Project Memory button

### 4.4 Agent Interaction Flow

User sends a message → agent classifies the task:

| Task Type | Routing | Planner? | Sandbox? |
|---|---|---|---|
| Code Q&A / search | Claude Haiku 4.5 → retrieval | No | No |
| Single line/file fix | Claude Sonnet 4.6 | No | E2B (verify) |
| New feature / multi-step | GPT-5.3 plans → Claude Sonnet executes | Yes (with interrupt) | E2B |
| Bug fix (multi-file) | GPT-5.3 plans → Claude Sonnet executes | Yes (with interrupt) | E2B |
| Code review | Claude Sonnet 4.6 | No | No |

**Memory is injected at every PlannerNode and CoderNode call** — conventions, architecture rules, and relevant past decisions are prepended to the system prompt automatically.

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

## 7. Evolutionary Memory System

### 7.1 Memory Injection (Before Every PlannerNode/CoderNode Call)

Before Claude Sonnet receives the coding task, the memory layer prepends a context block:

```typescript
// packages/memory/src/inject.ts

async function buildMemoryContext(projectId: string): Promise<string> {
  const [conventions, architecture, relevantDecisions] = await Promise.all([
    getProjectConventions(projectId),
    getProjectArchitecture(projectId),
    searchDecisionLog(projectId, currentTaskDescription), // semantic search
  ]);

  return `
## Project Intelligence (**follow strictly**)

### Coding Conventions
${formatConventions(conventions)}

### Architecture Rules
${formatArchitectureRules(architecture)}

### Relevant Past Decisions
${formatDecisions(relevantDecisions)}
`;
}
```

This block is injected as the first section of PlannerNode / CoderNode's system prompt — every single time.

### 7.2 Memory Extraction Pipeline (After PR Created)

Runs **asynchronously** after PR creation. Does not block the user.

```
PR Created
  └──▶ MemoryExtractorNode (Claude Haiku 4.5)
         ├──▶ Extract conventions delta
         │      └──▶ Merge into projectConventions (upsert)
         ├──▶ Extract decision record
         │      └──▶ Insert into decisionLog + embed goal+approach
         ├──▶ Update fileEvolution counts
         │      └──▶ Increment changeCount, bugFixCount, coChangedWith
         └──▶ Check if architecture summary needs refresh
                └──▶ If significant structural change → regenerate projectArchitecture
```

**Conventions extraction prompt (Claude Haiku 4.5):**
```
Given these diffs from an accepted PR, extract any coding conventions, 
patterns, or style preferences that should be applied to future code.
Return JSON only: { namingStyle, apiPattern, errorPattern, 
testingFramework, logging, preferredLibraries, fileStructure }
Only include fields you can confidently infer. Return {} if nothing notable.
```

**Decision extraction prompt (Claude Haiku 4.5):**
```
Given: user goal, the diffs produced, and the conversation history,
extract the engineering decision made.
Return JSON only: { goal, approach, reasoningSummary, 
rejectedAlternatives: [{approach, reasonRejected}], tags }
```

### 7.3 Memory Layers Summary

| Layer | Table | Updated When | Used When |
|---|---|---|---|
| **Conventions** | `projectConventions` | After every accepted PR | Before every CoderNode call |
| **Architecture** | `projectArchitecture` | After indexing + major PRs | Before CoderNode + PlannerNode |
| **Decisions** | `decisionLog` | After every PR | Semantic search before Planner/Coder |
| **Evolution** | `fileEvolution` | After every PR | Risk warnings, instability hints |

### 7.4 Decision Memory — Semantic Search

Before PlannerNode and CoderNode run, the agent searches `decision_log` semantically:

```typescript
// Search decisions relevant to current task
const relevantDecisions = await qdrant.search('decisions_{projectId}', {
  vector: await embed(userMessage),
  limit: 3,
  filter: { projectId: projectId }
});
```

This prevents contradictory changes — if rate limiting was added via Redis middleware, the agent won't suggest a controller-level approach in a future PR.

### 7.5 Evolution Tracking — Instability Warnings

When `fileEvolution.instabilityScore > 0.7` (changed in >70% of recent PRs):

```
⚠️ Warning: `src/services/PaymentService.ts` has been modified in 8 of the 
last 10 tasks. This may indicate instability or unclear responsibility boundaries.
```

This surfaces in the PlanTimeline UI component before execution starts.

---

## 8. LangGraph Agent Architecture

### Graph Definition

```
START
  └──▶ ClassifierNode         (Claude Haiku 4.5 — fast, cheap classification)
         ├──▶ QANode               (retrieval only, no memory injection needed)
         ├──▶ PlannerNode          (GPT-5.3 — plan with interrupt for user approval)
         │      └──▶ CoderNode     (Claude Sonnet 4.6 — diffs, memory injected)
         │              └──▶ ExecutorNode    (E2B or Daytona)
         │                      └──▶ ReviewerNode   (Claude Sonnet 4.6, interrupt)
         │                              ├──▶ CoderNode (retry, max 3)
         │                              └──▶ MemoryExtractorNode (async)
         │                                      └──▶ END
         └──▶ CoderNode           (direct, memory injected)
                └──▶ ExecutorNode
                        └──▶ ReviewerNode (interrupt)
                                ├──▶ CoderNode (retry)
                                └──▶ MemoryExtractorNode (async)
                                        └──▶ END
```

### Node Responsibilities

**ClassifierNode (Claude Haiku 4.5)**
- Input: user message + session history
- Output: `taskType` (qa | simpleFix | multiStep | review), `affectedFiles` hint
- System prompt: classify only, never answer the task

**QANode (Claude Haiku 4.5 / GPT-5.3 for complex)**
- Retrieves top-8 chunks from Qdrant (filtered by `projectId`)
- Re-ranks with Cohere Rerank
- Answers with citations (file + line refs)
- Surfaces instability warnings from `fileEvolution` if relevant

**PlannerNode (GPT-5.3)**
- Input: user request + retrieved context + **architecture rules + relevant decisions**
- Output: JSON array of steps `[{ step, file, action, description }]`
- **LangGraph `interrupt()`** — user must approve or edit plan before execution
- Shown in UI as interactive PlanTimeline

**CoderNode (Claude Sonnet 4.6)**
- Input: one plan step + file content + context chunks + **full memory context block**
- Output: unified diff only (never full file)
- System prompt: `output ONLY valid unified diffs. Follow project conventions strictly.`

**ExecutorNode (E2B)**
- Reuses the sandbox from CoderNode (via `sandboxId` in state) — no re-clone
- Runs the full test suite as final verification: `pnpm test --passWithNoTests`
- Returns: `{ success, output, errors }`

**ReviewerNode (Claude Sonnet 4.6)**
- Checks: does the diff satisfy the original user request?
- Checks: does it violate any architectural rules or conventions?
- Checks: any syntax errors, broken imports, missing edge cases?
- Output: `{ approved: boolean, feedback: string }`
- **LangGraph `interrupt()`** — user sees review result, can approve/reject/modify
- If not approved + retries < 3 → route back to CoderNode with feedback

**MemoryExtractorNode (Claude Haiku 4.5 — async)**
- Runs after user approves review (non-blocking)
- Extracts conventions delta, decision record, updates file evolution
- Emits a `memoryUpdated` custom event → frontend shows "Memory updated" toast

### Agent State Shape

```typescript
interface AgentState {
  sessionId: string;
  projectId: string;
  orgId: string;
  messages: BaseMessage[];
  taskType: 'qa' | 'simpleFix' | 'multiStep' | 'review';
  plan: PlanStep[] | null;
  currentStepIndex: number;
  retrievedChunks: CodeChunk[];
  memoryContext: string | null;        // injected conventions + arch + decisions
  sandboxId: string | null;            // E2B sandbox reused across nodes in same session
  generatedDiffs: FileDiff[];
  executionResult: ExecutionResult | null;
  reviewResult: ReviewResult | null;
  retryCount: number;
  memoryExtractionStatus: 'pending' | 'running' | 'done' | null;
}
```

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
└── DiffViewer or FilePreview                  (Monaco Editor wiht diff view)
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

- Every Qdrant collection namespaced: `{orgId}_{projectId}`
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
- [x] Implement ClassifierNode, QANode, CoderNode, ExecutorNode, ReviewerNode
- [x] Implement `packages/memory`: `inject.ts`, `extract.ts`, `search.ts`
- [x] Wire memory injection into CoderNode and PlannerNode
- [x] Implement MemoryExtractorNode (async, post-PR)
- [ ] Integrate Cohere Rerank for retrieval quality (Later)
- [x] Integrate E2B sandbox (ReAct CoderNode — full repo access)
- [x] Implement PlannerNode with `interrupt()` for human-in-the-loop approval
- [x] Implement ReviewerNode with `interrupt()` for user review
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