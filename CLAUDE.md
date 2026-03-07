NexGenesis AI: AI agent with persistent memory for large codebase

## Next.js version
This project uses **Next.js 16**. In Next.js 16, `middleware.ts` has been replaced by `proxy.ts`. Auth middleware and route protection is done in `apps/web/proxy.ts`, not `middleware.ts`. Never suggest or create a `middleware.ts` file.

---

## Project Overview
NexGenesis is a cloud AI coding agent that builds long-term project intelligence. It connects to a GitHub repo, indexes the codebase, and accumulates memory (conventions, architecture, decisions) across every PR — becoming smarter about each project over time.

**Core loop:** User sends message → ClassifierNode routes it → PlannerNode plans (multiStep) → CoderNode edits files in E2B sandbox (ReAct loop) → ExecutorNode runs tests → ReviewerNode reviews → MemoryExtractorNode learns.

---

## Monorepo Structure
```
/
├── apps/
│   ├── web/                          # Next.js 16 frontend (App Router)
│   └── agent/                        # LangGraph.js agent
│       ├── src/
│       │   ├── index.ts              # Entry point — exports `graph` for LangGraph Cloud
│       │   ├── agent/
│       │   │   ├── graph.ts          # StateGraph definition + routing logic
│       │   │   ├── state.ts          # AgentStateAnnotation (LangGraph state)
│       │   │   └── nodes/
│       │   │       ├── classifier.ts # Claude Sonnet 4.6 — routes to qa/simpleFix/multiStep/review
│       │   │       ├── qa.ts         # Claude Haiku 4.5 — Qdrant retrieval + answer with citations
│       │   │       ├── planner.ts    # Claude Sonnet 4.6 — creates PlanStep[], interrupt() for approval
│       │   │       ├── coder.ts      # Claude Sonnet 4.6 — ReAct loop in E2B sandbox
│       │   │       ├── executor.ts   # E2B — reconnects sandbox, runs test suite
│       │   │       ├── reviewer.ts   # Claude Sonnet 4.6 — automated review + interrupt() for user
│       │   │       └── memory-extractor.ts  # Claude Haiku 4.5 — async post-PR memory update
│       │   ├── indexing/             # Tree-sitter AST parsing + embedding pipeline
│       │   │   ├── pipeline.ts       # Full index pipeline (clone → parse → embed → upsert)
│       │   │   ├── reindex.ts        # Incremental re-index (git diff since lastIndexedAt)
│       │   │   ├── parser.ts         # Tree-sitter language detection + AST parsing
│       │   │   ├── chunker.ts        # AST node chunking (functions, classes, interfaces)
│       │   │   ├── embedder.ts       # text-embedding-3-small via OpenAI
│       │   │   ├── filter.ts         # Filters node_modules, .git, dist, build, *.lock
│       │   │   └── architect.ts      # Claude Haiku — generates initial projectArchitecture
│       │   └── sandbox/
│       │       ├── manager.ts        # E2B sandbox lifecycle (create, connect, clone repo, captureGitDiff, runTests)
│       │       └── tools.ts          # LangChain tools wrapping E2B: read_file, write_file, edit_file,
│       │                             #   delete_file, list_directory, glob, search_files, run_command
│       └── langgraph.json            # LangGraph Cloud config — points to graph.ts:graph
├── packages/
│   ├── types/src/index.ts            # All shared TypeScript types (PlanStep, FileDiff, AgentState, etc.)
│   ├── db/                           # Supabase client + typed schema
│   ├── memory/
│   │   ├── src/inject.ts             # buildMemoryContext() — conventions + arch + semantic decisions
│   │   └── src/extract.ts            # extractMemoryFromPR() — post-PR memory extraction
│   ├── qdrant/                       # Qdrant client, searchCodeChunks(), searchDecisions(), upsert
│   ├── github/                       # Octokit wrapper (GitHub App tokens, repo ops, PR creation)
│   └── ui/                           # Shared shadcn/ui components
└── apps/web/
    ├── app/                          # Next.js App Router pages
    ├── proxy.ts                      # Auth middleware (Clerk) — NOT middleware.ts
    └── hooks/useSupabase.ts          # Supabase client hook
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Frontend | Next.js 16 (App Router), shadcn/ui, Tailwind CSS |
| Auth | Clerk (GitHub OAuth + Organizations — compulsory org, even solo) |
| Agent Framework | LangGraph.js (TypeScript) |
| Agent Hosting | LangSmith (LangGraph Cloud) — `langgraph.json` configured |
| LLM — Classification | Claude Sonnet 4.6 (`claude-sonnet-4-6`) |
| LLM — Planning/Coding/Review | Claude Sonnet 4.6 (`claude-sonnet-4-6`) |
| LLM — Memory Extraction / QA | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| Embeddings | `text-embedding-3-small` (OpenAI) |
| Primary Database | Supabase (Postgres + Realtime) |
| Vector Database | Qdrant (Railway Docker) |
| Sandbox | **E2B only** — all task types (snippet, single-file, multi-file, full-repo) |
| CI/CD | GitHub Actions |

**No Daytona.** Daytona was removed — E2B handles everything.

---

## LangGraph Agent

### Graph Flow
```
START → ClassifierNode
  ├── qa / review   → QANode → END
  ├── simpleFix     → CoderNode → ExecutorNode → ReviewerNode
  │                       ↑ (retry, max 3)           ↓
  │                                           MemoryExtractorNode → END
  └── multiStep     → PlannerNode [interrupt: user approves plan]
                           → CoderNode → ExecutorNode → ReviewerNode
                                ↑ (retry, max 3)           ↓
                                                   MemoryExtractorNode → END
```

### Agent State (`apps/agent/src/agent/state.ts`)
Key fields to know:
- `taskType` — set by ClassifierNode, drives routing
- `plan: PlanStep[] | null` — steps with `status: pending|in_progress|completed|failed`
- `sandboxId: string | null` — E2B sandbox reused across nodes in the same session (no re-cloning)
- `memoryContext: string | null` — injected into PlannerNode + CoderNode system prompts
- `generatedDiffs: FileDiff[]` — captured via `git diff HEAD` after CoderNode finishes
- `retryCount` — Reviewer → Coder retry loop, max 3

### CoderNode — ReAct Loop (most important node)
- Gets or creates E2B sandbox via `getOrCreateSandbox(sandboxId, githubToken, repoFullName)`
- Repo is cloned to `/workspace` inside sandbox on first create; reconnects via `sandboxId` after that
- For **multiStep**: iterates each `PlanStep` in a `for` loop
  - Before step: sets `status: "in_progress"`, dispatches `plan_step_update` custom event
  - Runs focused ReAct loop for that step (read → edit → verify)
  - After step: sets `status: "completed"` or `"failed"`, dispatches event again
- For **simpleFix**: single ReAct loop, no step tracking
- At the end: `captureGitDiff(sandbox)` → `git diff HEAD` → parsed into `generatedDiffs`
- Custom events received by frontend via `useStream` `streamMode: ["custom"]`

### PlannerNode interrupts
`interrupt({ type: "plan_approval", plan })` — frontend must resume with:
- `{ action: "approve" }` or `{ action: "edit", editedPlan: PlanStep[] }`

### ReviewerNode interrupts
`interrupt({ type: "review_result", reviewResult, diffs, executionResult })` — frontend must resume with:
- `{ action: "approve" }` or `{ action: "reject", feedback: string }`

---

## Memory System (`packages/memory/`)

### Injection (before every PlannerNode + CoderNode call)
`buildMemoryContext(supabase, qdrant, openai, projectId, taskDescription)` pulls:
1. `projectConventions` table → naming, API patterns, error handling, testing framework
2. `projectArchitecture` table → layers, rules, module summaries, service relationships
3. Semantic search in Qdrant `decisions_{projectId}` → top 3 relevant past decisions

Returns a formatted `## Project Intelligence` block prepended to system prompt.

### Extraction (async, after PR approval)
`extractMemoryFromPR(...)` runs fire-and-forget:
- Extracts conventions delta → upserts `projectConventions`
- Extracts decision record → inserts `decisionLog` + embeds in Qdrant
- Updates `fileEvolution` (changeCount, bugFixCount, coChangedWith)
- Refreshes `projectArchitecture` if structural change detected

---

## E2B Sandbox (`apps/agent/src/sandbox/`)

### `manager.ts`
- `getOrCreateSandbox(sandboxId, githubToken, repoFullName)` → Sandbox.connect() or Sandbox.create() + git clone
- `captureGitDiff(sandbox)` → `git diff HEAD` → raw unified diff string
- `runTests(sandbox)` → `pnpm test --passWithNoTests` → `{ success, output }`

### `tools.ts`
Tools passed to `model.bindTools()` in CoderNode:
- `read_file(path)` — reads from `/workspace/{path}`
- `write_file(path, content)` — creates or overwrites
- `edit_file(path, old_str, new_str)` — precise find-replace (preferred for edits)
- `delete_file(path)` — removes file
- `list_directory(path)` — lists entries with [file]/[dir] prefix
- `glob(pattern)` — find files by pattern via shell `find`
- `search_files(pattern, path?, include?)` — grep across files
- `run_command(command)` — runs in `/workspace`, 2-min timeout

---

## Supabase Schema (key tables)
- `projects` — repos, `indexStatus`, `lastIndexedAt`, `githubInstallationId`
- `sessions` — per-project chat sessions, `langgraphThreadId`
- `projectConventions` — Layer 1 memory (naming, patterns)
- `projectArchitecture` — Layer 2 memory (layers, rules, summaries)
- `decisionLog` — Layer 3 memory (goal, approach, reasoning, tags, embedding)
- `fileEvolution` — Layer 4 memory (instabilityScore, changeCount, coChangedWith)
- `memoryEdits` — audit trail of user edits to memory
- `indexingJobs` — real-time indexing progress (Supabase Realtime → frontend)

All tables have `orgId` + `projectId` columns. All queries MUST filter by both.

---

## Frontend (`apps/web/`)
- **Next.js 16 App Router** — pages in `app/`
- **Auth** — `proxy.ts` (not middleware.ts) with Clerk
- **Streaming** — `useStream()` from `@langchain/langgraph-sdk/react`
  - `streamMode: ["values", "messages", "custom"]`
  - `custom` events: `plan_step_update`, `memoryUpdated`
- **Workspace UI** — Allotment panels: FileTree | Chat | DiffViewer (Monaco)
- **PlanTimeline** — reads `plan_step_update` custom events to show step progress live

---

## Phase Status
- **Phase 1** ✅ Foundation (Turborepo, Clerk, Supabase, Qdrant, GitHub App)
- **Phase 2** ✅ Indexing Pipeline (tree-sitter, AST chunks, embeddings, re-index)
- **Phase 3** ✅ Agent Core — all nodes implemented. Gaps: Cohere Rerank in QANode (deferred), `search.ts` separate file in memory package (functional but not split out), LangSmith deployment (ops step)
- **Phase 4** 🔲 Frontend Workspace (not started)
- **Phase 5** 🔲 Polish (not started)

---

## Conventions & Rules

### TypeScript
- All packages use `"type": "module"` — imports must use `.js` extensions (e.g. `import { x } from "./foo.js"`)
- Workspace imports: `@workspace/types`, `@workspace/db`, `@workspace/memory`, `@workspace/qdrant`, `@workspace/github`
- Zod is available (`zod` in agent package.json) — use for tool schemas in sandbox/tools.ts

### LangGraph
- Node functions signature: `async function xNode(state: AgentStateType): Promise<Partial<AgentStateType>>`
- Return only the fields that changed — LangGraph merges partials
- `messages` uses `messagesStateReducer` — return new messages to append, not the full array
- Use `interrupt()` for human-in-the-loop pauses (PlannerNode, ReviewerNode)
- Dispatch custom events with `dispatchCustomEvent(eventName, payload)` from `@langchain/core/callbacks/dispatch`

### LLM Models
- Classification: `claude-sonnet-4-6` (was Haiku in SPEC, upgraded in code)
- Planning / Coding / Reviewing: `claude-sonnet-4-6`
- QA / Memory extraction: `claude-haiku-4-5-20251001`
- Embeddings: `text-embedding-3-small` (OpenAI)

### E2B Sandbox
- All sandbox paths are absolute. `manager.ts` and `tools.ts` use `WORKSPACE_DIR = "/workspace"`
- The `edit_file` tool does an exact string find-replace — `old_str` must be unique in the file
- Always call `getOrCreateSandbox` with `state.sandboxId` so the sandbox is reused (no re-clone per message)
- `captureGitDiff` returns empty string if no changes — check before parsing

### Qdrant Collections
- Code chunks: `{orgId}_{projectId}` (filtered by projectId payload)
- Decision log: `decisions_{projectId}`

---

## Do NOT
- Create `middleware.ts` — use `proxy.ts` for auth in Next.js 16
- Use Daytona — removed, E2B only
- Import Daytona SDK — it's been removed from package.json
- Return the full `messages` array from a node — only return new messages to append
- Forget `.js` extensions on local imports inside `apps/agent` (ESM module)
- Call `sandbox.files.delete()` — the method is `sandbox.files.remove()` (E2B API)
- Query Supabase without filtering by both `orgId` AND `projectId`
- Commit from inside the sandbox — changes stay in sandbox; the GitHub API + pendingChanges table handles PR creation

## DO
- Read a file with `read_file` tool before editing it in ReAct loop
- Use `edit_file` (find-replace) for targeted edits, `write_file` for new files or full rewrites
- Store `sandboxId` in AgentState so the sandbox persists across messages in a session
- Filter Qdrant results by `projectId` payload — Qdrant collections may contain chunks from multiple projects
- Dispatch `plan_step_update` custom events when a plan step status changes
- Keep node functions returning `Partial<AgentStateType>` — only changed fields
