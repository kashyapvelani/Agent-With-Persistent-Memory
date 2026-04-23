# ADE (Agentic Development Environment) - Complete Project Specification

> Use this document as the authoritative context to generate a full academic project report. Every section below maps to one or more chapters of the report. All technical details, algorithms, architectures, database schemas, and implementation specifics are included.

---

## Table of Contents

1. [Project Identity](#1-project-identity)
2. [Introduction and Motivation (Chapter 1)](#2-introduction-and-motivation)
3. [Literature Survey Context (Chapter 2)](#3-literature-survey-context)
4. [System Architecture and Fundamental Concepts (Chapter 3)](#4-system-architecture-and-fundamental-concepts)
5. [Implementation: AI Agent Pipeline (Chapter 4)](#5-implementation-ai-agent-pipeline)
6. [Implementation: Persistent Memory System (Chapter 5)](#6-implementation-persistent-memory-system)
7. [Conclusions and Future Work (Chapter 6)](#7-conclusions-and-future-work)
8. [References](#8-references)
9. [Appendix A: Database Schema](#appendix-a-database-schema)
10. [Appendix B: Complete Type Definitions](#appendix-b-complete-type-definitions)
11. [Appendix C: Agent System Prompts and Tool Schemas](#appendix-c-agent-system-prompts-and-tool-schemas)

---

## 1. Project Identity

- **Project Name:** ADE - Agentic Development Environment
- **Full Title:** AI Agentic Development Environment with Persistent Memory for Large Codebases
- **Repository:** NexGenesis monorepo (Turborepo + pnpm workspaces)
- **Development Timeline:** March 3, 2026 - April 18, 2026 (ongoing)
- **Technology Domain:** AI-Assisted Software Engineering, Large Language Models, Retrieval-Augmented Generation

### Development Milestones (Git History)

| Date | Milestone |
|---|---|
| 2026-03-03 | Initial commit — monorepo scaffold |
| 2026-03-06 | Phase 1 and Phase 2 completed (Foundation + Indexing Pipeline) |
| 2026-03-07 | Phase 3: LangGraph Agent core implemented |
| 2026-03-09 | Phase 4: Dashboard page and project pages |
| 2026-03-11 | Workspace page, GitHub commit integration, agent architecture changes |
| 2026-03-12 | Landing page, Dockerfiles for agent and indexing worker |
| 2026-03-13 | Auth sync fixes, type error fixes, Dockerfile for indexing |
| 2026-03-25 | Project naming updates |
| 2026-04-02 | Sentry error monitoring integration |
| 2026-04-03 | Sentry API and frontend error handling refinement |

---

## 2. Introduction and Motivation

### 2.1 Problem Statement

Modern software development faces a critical challenge: as codebases grow in size and complexity, developers spend an increasing proportion of their time understanding existing code rather than writing new code. Studies suggest that developers spend 58-70% of their time on code comprehension activities. Existing AI coding assistants (GitHub Copilot, Cursor, ChatGPT) suffer from a fundamental limitation: they treat each interaction as stateless. Every new conversation starts with zero project context, forcing developers to repeatedly explain their codebase's conventions, architecture, and past decisions.

### 2.2 Motivation

The motivation behind ADE arises from three key observations:

1. **Context Loss:** Current AI coding tools lack persistent memory. A developer who spent 30 minutes explaining their project's architecture to an AI assistant on Monday must repeat the entire explanation on Tuesday. This creates a "Groundhog Day" problem where the AI never truly learns the project.

2. **Shallow Understanding:** Code completion tools operate at the token level without understanding the project's architectural intent, coding conventions, or the reasoning behind past decisions. They generate syntactically correct but contextually inappropriate code.

3. **Disconnected Workflows:** Existing tools operate as isolated chat interfaces. They cannot directly interact with the codebase — reading files, running tests, creating pull requests — in a sandboxed, safe environment. The developer must manually copy-paste code between the AI and their IDE.

### 2.3 Proposed Solution

ADE is a cloud-based AI coding agent that builds long-term project intelligence. It addresses the above problems through three innovations:

1. **Persistent Memory System:** A four-layer memory architecture (conventions, architecture, decisions, file evolution) that accumulates knowledge across every interaction and pull request.

2. **Agentic Architecture:** A LangGraph-based autonomous agent that can read files, edit code, run tests, and create pull requests in a secure cloud sandbox (E2B), with human-in-the-loop checkpoints for plan approval and code review.

3. **Retrieval-Augmented Generation (RAG):** A code indexing pipeline using Tree-sitter AST parsing and vector embeddings that enables semantic code search across the entire repository.

### 2.4 Scope of Work

The thesis work encompasses:
- Design and implementation of a multi-node AI agent using LangGraph.js with Claude LLMs
- Development of a Tree-sitter-based code indexing pipeline with vector embeddings
- Implementation of a four-layer persistent memory system
- Building a real-time web frontend with Next.js 16 for agent interaction
- Integration with GitHub via a GitHub App for repository access and PR creation
- Secure code execution in E2B cloud sandboxes
- Authentication and multi-tenancy using Clerk Organizations

---

## 3. Literature Survey Context

### 3.1 Key Research Areas and Topics for Literature Survey

The following topics should be surveyed with academic references:

#### 3.1.1 Large Language Models for Code Generation
- Transformer architecture (Vaswani et al., 2017) — the foundation of all modern LLMs
- Codex and code-trained models (Chen et al., 2021) — first large-scale code generation model
- Claude family of models (Anthropic, 2024-2026) — the LLMs used in ADE
- Code generation benchmarks: HumanEval, MBPP, SWE-bench

#### 3.1.2 AI Agents and Agentic Systems
- ReAct pattern (Yao et al., 2022) — Reasoning + Acting loop that ADE's CoderNode uses
- LangChain and LangGraph frameworks (Harrison Chase et al., 2023-2024) — the agent framework used
- Tool-augmented LLMs (Schick et al., 2023) — agents that invoke external tools
- Human-in-the-loop AI systems — the interrupt/approval pattern used in ADE
- SWE-Agent (Yang et al., 2024) — autonomous software engineering agent benchmark

#### 3.1.3 Retrieval-Augmented Generation (RAG)
- RAG original paper (Lewis et al., 2020) — combining retrieval with generation
- Dense passage retrieval and embedding models — text-embedding-3-small used in ADE
- Vector databases (Qdrant, Pinecone, Weaviate) — nearest neighbor search for code chunks
- Code search using embeddings vs. traditional grep/regex

#### 3.1.4 Abstract Syntax Tree (AST) Parsing
- Tree-sitter parser (Max Brunsfeld, 2018) — incremental parsing framework used in ADE
- AST-based code chunking vs. naive text splitting
- Multi-language parsing (TypeScript, JavaScript, Python)

#### 3.1.5 Persistent Memory in AI Systems
- Long-term memory architectures for conversational AI
- MemGPT (Packer et al., 2023) — OS-inspired memory management for LLMs
- Knowledge graphs for software projects
- Decision logging and architectural decision records (ADRs)

#### 3.1.6 Secure Code Execution Environments
- Sandboxed execution environments (E2B, Docker, Firecracker)
- Cloud development environments vs. local execution
- Security considerations in AI-generated code execution

#### 3.1.7 Existing AI Coding Tools (Comparative Analysis)
- GitHub Copilot — token-level completion, no memory
- Cursor — IDE-integrated AI, limited project context
- Devin (Cognition Labs) — autonomous AI developer
- Aider — terminal-based AI pair programming
- OpenHands (formerly OpenDevin) — open-source AI software engineer

### 3.2 Objective of Thesis Work

Based on the literature survey, the objectives of this thesis are:

1. To design and implement a multi-node agentic AI system capable of autonomously understanding, modifying, and testing code in large repositories.
2. To develop a four-layer persistent memory system that accumulates project intelligence across interactions, enabling the agent to improve its understanding of each project over time.
3. To build a Tree-sitter-based code indexing pipeline with vector embeddings for semantic code retrieval.
4. To create a real-time web interface for human-AI collaboration with plan approval and code review workflows.
5. To evaluate the system's ability to maintain project context and generate contextually appropriate code changes.

---

## 4. System Architecture and Fundamental Concepts

### 4.1 High-Level Architecture

ADE follows a microservices-inspired architecture with clear separation of concerns:

```
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|   Next.js 16     |<--->|  LangGraph Agent |<--->|   E2B Sandbox    |
|   Frontend       |     |  (LangGraph      |     |   (Cloud VM)     |
|   (App Router)   |     |   Cloud)         |     |                  |
+--------+---------+     +--------+---------+     +------------------+
         |                         |
         v                         v
+------------------+     +------------------+
|                  |     |                  |
|   Clerk Auth     |     | Supabase         |
|   (GitHub OAuth) |     | (PostgreSQL +    |
|                  |     |  Realtime)       |
+------------------+     +--------+---------+
                                   |
                          +--------+---------+
                          |                  |
                          |   Qdrant         |
                          |   (Vector DB     |
                          |    on Railway)   |
                          +------------------+
```

### 4.2 Technology Stack (Complete)

| Layer | Technology | Version/Details |
|---|---|---|
| **Monorepo** | Turborepo + pnpm workspaces | pnpm 10.4.1, Node >= 20 |
| **Frontend** | Next.js 16 (App Router) | v16.1.6, React 19.2.4 |
| **UI Components** | shadcn/ui + Tailwind CSS | Shared via @workspace/ui |
| **Code Editor** | CodeMirror 6 | With diff viewer, multiple language support |
| **Panel Layout** | Allotment | v1.20.5, resizable panels |
| **Animation** | Framer Motion | v12.35.2 |
| **Diff Patching** | diff (npm) | v7.0.0 (for applying unified diffs to files) |
| **Auth** | Clerk | v7.0.1 (GitHub OAuth + Organizations) |
| **Agent Framework** | LangGraph.js | v1.2.0 (TypeScript) |
| **Agent Hosting** | LangGraph Cloud (LangSmith) | Via langgraph.json config |
| **LLM (Primary)** | Claude Sonnet 4.6 | Classification, planning, coding, review |
| **LLM (Lightweight)** | Claude Haiku 4.5 | QA, memory extraction, compaction, architecture |
| **Embeddings** | text-embedding-3-small | OpenAI, 1536 dimensions |
| **Primary Database** | Supabase | PostgreSQL + Realtime + pgvector |
| **Vector Database** | Qdrant | Hosted on Railway (Docker) |
| **Sandbox** | E2B | Cloud VMs, 30-min timeout |
| **GitHub Integration** | @octokit/app + @octokit/rest | GitHub App with installation tokens |
| **Error Monitoring** | Sentry | @sentry/nextjs v10, 100% trace sample rate |
| **Agent Observability** | LangSmith | Tracing all LLM calls and agent iterations |
| **Caching** | Redis | Hosted on Railway |
| **AST Parsing** | Tree-sitter | v0.21.1 with TS, JS, Python grammars |
| **Schema Validation** | Zod | v3.25.76 |
| **Language** | TypeScript | v5.9.3, ESM modules throughout |

### 4.3 Monorepo Structure

```
/
+-- apps/
|   +-- web/                          # Next.js 16 frontend (App Router)
|   |   +-- app/                      # App Router pages and API routes
|   |   |   +-- api/
|   |   |   |   +-- auth/sync/        # POST: Sync Clerk user + org to Supabase
|   |   |   |   +-- github/
|   |   |   |   |   +-- repos/        # GET: List GitHub repos via installation token
|   |   |   |   |   +-- callback/     # GET: GitHub App install callback
|   |   |   |   +-- projects/         # GET/POST: List/create projects
|   |   |   |   +-- webhooks/clerk/   # POST: Clerk webhook handler
|   |   |   +-- dashboard/            # Dashboard page
|   |   |   +-- project/[id]/         # Project workspace page
|   |   |   +-- sign-in/              # Clerk sign-in page
|   |   |   +-- sign-up/              # Clerk sign-up page
|   |   +-- proxy.ts                  # Auth middleware (Clerk) - replaces middleware.ts
|   |   +-- components/               # Shared components (SyncUser, etc.)
|   |   +-- features/                 # Feature-specific components
|   |   |   +-- dashboard/components/ # ProjectGrid, NewProjectDialog
|   |   +-- hooks/                    # useSupabase, etc.
|   |
|   +-- agent/                        # LangGraph.js agent
|       +-- src/
|       |   +-- index.ts              # Entry point: exports graph for LangGraph Cloud
|       |   +-- agent/
|       |   |   +-- graph.ts          # StateGraph definition (init -> agentLoop -> memoryExtract)
|       |   |   +-- state.ts          # AgentStateAnnotation (LangGraph v2 state)
|       |   |   +-- nodes/
|       |   |   |   +-- init.ts       # Setup: memory loading, sandbox creation
|       |   |   |   +-- agent-loop.ts # Core agentic loop: Claude Sonnet + tools
|       |   |   |   +-- memory-extractor.ts  # Post-task memory extraction
|       |   |   +-- tools/
|       |   |   |   +-- control-tools.ts  # Plan, review, finish lifecycle tools
|       |   |   |   +-- memory-tools.ts   # recall_memory, search_code
|       |   |   +-- utils/
|       |   |       +-- compaction.ts     # Conversation history compaction
|       |   |       +-- github-token.ts   # GitHub token resolution
|       |   +-- indexing/
|       |   |   +-- pipeline.ts       # Full index pipeline
|       |   |   +-- reindex.ts        # Incremental re-index
|       |   |   +-- parser.ts         # Tree-sitter AST parsing
|       |   |   +-- chunker.ts        # AST node chunking
|       |   |   +-- embedder.ts       # OpenAI embedding
|       |   |   +-- filter.ts         # File filtering rules
|       |   |   +-- architect.ts      # Architecture summary generation
|       |   |   +-- worker.ts         # Indexing worker process
|       |   +-- sandbox/
|       |       +-- manager.ts        # E2B sandbox lifecycle
|       |       +-- tools.ts          # LangChain tools wrapping E2B
|       +-- langgraph.json            # LangGraph Cloud config
|
+-- packages/
    +-- types/src/index.ts            # All shared TypeScript types
    +-- db/                           # Supabase client + typed schema
    |   +-- migrations/               # 6 SQL migration files
    +-- memory/
    |   +-- src/inject.ts             # buildAlwaysOnMemory(), surfaceRelevantMemories()
    |   +-- src/extract.ts            # extractMemoryFromPR() pipeline
    +-- qdrant/                       # Qdrant client, search, upsert functions
    |   +-- src/index.ts              # Client factory + exports
    |   +-- src/collections.ts        # Collection management
    |   +-- src/chunks.ts             # Code chunk CRUD
    |   +-- src/decisions.ts          # Decision CRUD
    |   +-- src/sessions.ts           # Session summary CRUD
    +-- github/                       # GitHub App integration
    |   +-- src/app.ts                # createGitHubApp(), getInstallationOctokit()
    +-- ui/                           # Shared shadcn/ui components
    +-- eslint-config/                # Shared ESLint configuration
    +-- typescript-config/            # Shared TypeScript configuration
```

### 4.4 Core Architectural Concepts

#### 4.4.1 The ReAct (Reasoning + Acting) Pattern

ADE's agent loop implements the ReAct pattern (Yao et al., 2022), where the LLM alternates between:
1. **Reasoning**: Analyzing the current state, deciding what to do next
2. **Acting**: Invoking a tool (read file, edit file, run command, search code)
3. **Observing**: Processing the tool result and updating its understanding

This cycle repeats until the agent determines the task is complete (max 50 iterations).

```
Iteration 1: Think -> read_file("src/api.ts") -> Observe file contents
Iteration 2: Think -> edit_file("src/api.ts", old, new) -> Observe success
Iteration 3: Think -> bash("pnpm test") -> Observe test results
Iteration 4: Think -> request_review_approval() -> Human reviews
Iteration 5: Think -> finish("Added error handling to API endpoint") -> Done
```

#### 4.4.2 Human-in-the-Loop via LangGraph Interrupts

LangGraph provides an `interrupt()` primitive that pauses graph execution and waits for human input. ADE uses this at two critical points:

1. **Plan Approval** (PlannerNode/request_plan_approval tool): After the agent creates a multi-step plan, execution pauses. The user can approve or edit the plan before code changes begin.

2. **Code Review** (ReviewerNode/request_review_approval tool): After code changes are made, execution pauses. The user sees a diff view and can approve or reject with feedback.

```
Agent creates plan -> interrupt(plan_approval) -> [PAUSED]
                                                     |
User approves ----------------------------------------+
                                                     |
Agent executes plan -> interrupt(review_result) -> [PAUSED]
                                                     |
User approves/rejects --------------------------------+
```

#### 4.4.3 Prompt Caching for Cost Optimization

ADE leverages Anthropic's prompt caching feature. The system prompt is split into content blocks with `cache_control: { type: "ephemeral" }` markers. Stable blocks (base system prompt, always-on memory) are cached across iterations, reducing API costs by up to 90% for cached tokens.

```typescript
systemBlocks.push({
  type: "text",
  text: BASE_SYSTEM_PROMPT,
  cache_control: { type: "ephemeral" },  // Cached across iterations
});
```

#### 4.4.4 Conversation Compaction

When conversation history exceeds ~80,000 tokens, ADE uses Claude Haiku to summarize the oldest 60% of messages into a single summary message. The recent 40% is kept intact. This prevents context window overflow while preserving critical information (decisions made, files modified, errors encountered).

Algorithm:
1. Estimate token count (characters / 4)
2. If below threshold (80K), return null (no compaction needed)
3. Split messages at 60% point
4. Summarize older messages with Haiku (preserving decisions, files, errors, next steps)
5. Replace old messages with a single SystemMessage summary
6. Keep recent messages intact

#### 4.4.5 Tool Repetition Detection

To prevent the agent from getting stuck in loops (calling the same search tool repeatedly with similar queries), ADE implements a repetition detection system:

1. Track recent tool calls in the last 30 messages
2. For search tools, compute similarity based on word overlap (>60% = similar)
3. If same tool called 3+ times with similar arguments, inject a warning into the tool output
4. Warning instructs the agent to try a completely different approach

### 4.5 Agent Graph Architecture (v2)

The agent uses a simplified single-loop architecture (v2), inspired by Claude Code's design:

```
START --> initNode --> agentLoopNode --+--> agentLoopNode (loop)
                                      |
                                      +--> memoryExtractorNode --> END
```

**Graph Definition (graph.ts):**
```typescript
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

**Routing Logic (shouldContinue):**
```typescript
function shouldContinue(state): "agentLoop" | "memoryExtract" {
  if (state.finished) return "memoryExtract";
  if (state.iterationCount >= 50) return "memoryExtract";
  return "agentLoop";
}
```

### 4.6 Agent State Definition

The agent state is defined using LangGraph's Annotation system:

```typescript
export const AgentStateAnnotation = Annotation.Root({
  // Core conversation
  messages: Annotation<BaseMessage[]>({ value: messagesStateReducer, default: () => [] }),

  // Identity (set once per invocation)
  sessionId: Annotation<string>({ value: replace, default: () => "" }),
  projectId: Annotation<string>({ value: replace, default: () => "" }),
  orgId: Annotation<string>({ value: replace, default: () => "" }),

  // Mode: "plan" (read-only until approved) or "auto" (full access)
  mode: Annotation<AgentMode>({ value: replace, default: () => "auto" }),

  // E2B Sandbox
  sandboxId: Annotation<string | null>({ value: replace, default: () => null }),

  // Memory
  alwaysOnMemory: Annotation<string>({ value: replace, default: () => "" }),
  surfacedMemories: Annotation<string>({ value: replace, default: () => "" }),

  // Loop control
  iterationCount: Annotation<number>({ value: replace, default: () => 0 }),
  finished: Annotation<boolean>({ value: replace, default: () => false }),

  // Outputs
  generatedDiffs: Annotation<FileDiff[]>({ value: replace, default: () => [] }),
  plan: Annotation<PlanStep[] | null>({ value: replace, default: () => null }),
  memoryExtractionStatus: Annotation<MemoryExtractionStatus>({
    value: replace, default: () => null,
  }),
});
```

Key design decisions:
- **messagesStateReducer** for `messages`: appends new messages instead of replacing (LangGraph built-in)
- **replace** reducer for all scalar fields: last-write-wins semantics
- **mode** field: supports "plan" (read-only tools, must create plan) and "auto" (full tool access)
- **sandboxId** persists across iterations so the sandbox is reused (no re-cloning)

---

## 5. Implementation: AI Agent Pipeline

### 5.1 Node 1: InitNode (Zero LLM Calls)

**Purpose:** Pure setup node. No LLM calls. Prepares memory context and sandbox.

**Steps:**
1. **Load Always-On Memory:** Queries `projectConventions` and `projectArchitecture` tables from Supabase. Formats into a `## Project Intelligence` block (~2-3K tokens) that is prepended to every system prompt.

2. **Proactive Memory Surfacing:** Embeds the user's latest message using `text-embedding-3-small`, then searches Qdrant's decision and session summary collections with a high threshold (>0.85) to find only highly relevant past context.

3. **Sandbox Creation:** Calls `getOrCreateSandbox(sandboxId, githubToken, repoFullName)`:
   - If `sandboxId` exists, attempts to reconnect to the existing sandbox
   - If reconnection fails or no ID, creates a new E2B sandbox and clones the repository into `/workspace`
   - Configures git identity for clean diffs

**Returns:** `{ alwaysOnMemory, surfacedMemories, sandboxId, iterationCount: 0, finished: false, generatedDiffs: [] }`

### 5.2 Node 2: AgentLoopNode (Core Agentic Loop)

**Purpose:** The heart of the system. Each iteration makes one Claude Sonnet 4.6 call with all available tools.

**LLM Model:** `claude-sonnet-4-6` (temperature: 0)

**System Prompt Structure (with prompt caching):**

```
Block 1: BASE_SYSTEM_PROMPT (cached)
  - Role: "You are ADE, an expert AI coding agent..."
  - Approach: Understand -> Explore -> Plan -> Execute -> Verify -> Iterate -> Finish
  - Rules: Follow conventions, read before edit, run tests, fix breakages

Block 2: Mode instruction (if plan mode, before plan approval)
  - "You are in plan mode. You can ONLY use read-only tools..."

Block 3: Always-on memory (cached, conventions + architecture)
  - Project conventions (naming, API patterns, error handling, testing)
  - Architecture rules (layers, rules, module summaries, service relationships)

Block 4: Surfaced memories (per-invocation, past decisions/sessions)
  - Decisions and session summaries with relevance > 0.85
```

**Available Tools (based on mode):**

*Read-Only Tools (always available):*
| Tool | Description | Schema |
|---|---|---|
| `read_file(path)` | Read file contents (truncated >500 lines) | `{ path: string }` |
| `list_directory(path)` | List directory entries with [file]/[dir] prefix | `{ path: string }` |
| `glob(pattern)` | Find files matching glob pattern | `{ pattern: string }` |
| `search_files(pattern, path?, include?)` | Grep across files with line numbers | `{ pattern: string, path?: string, include?: string }` |

*Write Tools (auto mode only):*
| Tool | Description | Schema |
|---|---|---|
| `write_file(path, content)` | Create or overwrite file | `{ path: string, content: string }` |
| `edit_file(path, old_str, new_str)` | Precise find-replace edit | `{ path: string, old_str: string, new_str: string }` |
| `delete_file(path)` | Remove a file | `{ path: string }` |
| `bash(command)` | Run shell command (2-min timeout, output capped at 5K chars) | `{ command: string }` |

*Memory Tools (always available):*
| Tool | Description | Schema |
|---|---|---|
| `recall_memory(queries)` | Search past decisions and session summaries via embeddings | `{ queries: string[] (1-5) }` |
| `search_code(query, limit?)` | Semantic search of indexed code chunks | `{ query: string, limit?: number }` |

*Control Flow Tools (always available):*
| Tool | Description | Schema |
|---|---|---|
| `create_todo(steps)` | Create execution plan with steps | `{ steps: PlanStep[] }` |
| `update_todo(stepIndex, status)` | Update plan step status | `{ stepIndex: number, status: string }` |
| `request_plan_approval(summary)` | Interrupt for user plan approval | `{ summary: string }` |
| `request_review_approval(summary, selfReviewNotes?)` | Interrupt for code review | `{ summary: string, selfReviewNotes?: string }` |
| `finish(summary)` | Signal task completion | `{ summary: string }` |

**Iteration Logic:**
1. Check if conversation compaction is needed (>80K tokens)
2. Reconnect to E2B sandbox if sandboxId exists
3. Build tool set based on current mode (plan vs. auto)
4. Build system prompt with prompt caching blocks
5. Invoke Claude Sonnet with system prompt + conversation history + bound tools
6. Process each tool call: execute, check for repetition, append ToolMessage
7. If no tool calls: mark as finished (simple QA response)
8. Return updated state: `{ messages, iterationCount+1, finished, plan, generatedDiffs, mode }`

### 5.3 Node 3: MemoryExtractorNode

**Purpose:** Extracts lasting knowledge from the completed interaction. Runs after the agent finishes.

**LLM Model:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)

**Three parallel extraction pipelines:**

#### 5.3.1 Convention Extraction
- Input: Unified diff from all code changes
- LLM Prompt: "Extract coding conventions from this PR diff. Return JSON with fields: namingStyle, apiPattern, errorPattern, testingFramework, logging, preferredLibraries, fileStructure"
- Output: Merged into existing `projectConventions` row (or creates new one)
- Logic: Existing conventions are preserved; new conventions overwrite matching fields; `prCount` is incremented

#### 5.3.2 Decision Extraction
- Input: Goal + conversation history + diffs
- LLM Prompt: "Extract the engineering decision from this PR. Return JSON with: goal, approach, reasoningSummary, rejectedAlternatives, tags"
- Output: Inserted into `decisionLog` table in Supabase AND upserted into Qdrant `decisions_{projectId}` collection
- Embedding: `text-embedding-3-small` embeds `goal + approach` text for semantic search

#### 5.3.3 File Evolution Update
- Input: List of modified files
- Output: For each file, upserts into `fileEvolution` table:
  - Increments `changeCount`
  - Adds co-changed files to `coChangedWith` array
  - Updates `lastChangedAt` timestamp
  - Computes `instabilityScore = min(changeCount / 10, 1.0)`

### 5.4 E2B Sandbox System

**Sandbox Lifecycle:**

```
getOrCreateSandbox(sandboxId, githubToken, repoFullName)
    |
    +-- sandboxId exists? -> Sandbox.connect(sandboxId) -> Extend timeout -> Return
    |
    +-- No/expired -> Sandbox.create() -> mkdir /workspace -> git clone -> git config -> Return
```

**Key Parameters:**
- Timeout: 30 minutes (`SANDBOX_TIMEOUT_MS = 30 * 60 * 1000`)
- Clone: `--depth=1` for speed
- Auth: `x-access-token:${githubToken}@github.com/${repo}.git`
- Working directory: `/workspace`
- Git identity: `agent@ADE.ai` / `ADE Agent`

**Error Handling in Clone:**
- Permission denied -> "Sandbox filesystem permission error"
- Repository not found + no token -> "No GitHub token was provided"
- Repository not found + token -> "Check GitHub App access"
- Authentication failed -> "Token may be expired or invalid"
- On any clone error: kills the sandbox before re-throwing

**captureGitDiff:** Runs `git -C /workspace diff HEAD 2>&1` to capture all uncommitted changes.

**runTests:** Runs `pnpm test --passWithNoTests || npm test --passWithNoTests || echo "No test runner found"` with a 5-minute timeout.

### 5.5 Indexing Pipeline

The indexing pipeline transforms a GitHub repository into searchable vector embeddings stored in Qdrant.

#### 5.5.1 Full Indexing Pipeline (`pipeline.ts`)

```
1. Get GitHub App installation Octokit
2. Fetch full repository tree via GitHub API
3. Filter indexable files (shouldIndex)
4. Ensure Qdrant collection exists
5. Get current HEAD commit SHA
6. Process files in batches of 10:
   a. Fetch file content from GitHub
   b. Parse with Tree-sitter -> extract AST chunks
   c. Embed chunks via OpenAI (batches of 100)
   d. Upsert into Qdrant
   e. Update real-time progress in indexingJobs table
7. Generate architectural summary with Claude Haiku
8. Mark project as "ready" in Supabase
```

#### 5.5.2 File Filtering (`filter.ts`)

**Skipped directories:** node_modules, .git, dist, build, .next, coverage, __pycache__, .venv, venv, .mypy_cache, .pytest_cache, out, .turbo, .cache, .yarn, vendor, .svn, target

**Supported extensions:** .ts, .tsx, .js, .jsx, .py

**Skipped file patterns:** *.lock, *.min.js, *.min.css, *.d.ts, *.map, package-lock.json, yarn.lock, pnpm-lock.yaml, .gitignore, .env, .env.local

#### 5.5.3 Tree-sitter AST Parsing (`parser.ts`)

**Supported languages and grammars:**
- TypeScript (.ts): `tree-sitter-typescript` (typescript grammar)
- TSX (.tsx): `tree-sitter-typescript` (tsx grammar)
- Python (.py): `tree-sitter-python`
- JavaScript (.js, .jsx): `tree-sitter-javascript`

**Target AST node types (TypeScript/JavaScript):**
- function_declaration
- generator_function_declaration
- class_declaration
- abstract_class_declaration
- interface_declaration
- type_alias_declaration
- enum_declaration
- method_definition

**Target AST node types (Python):**
- function_definition
- class_definition

**Parsing algorithm:**
1. Load grammar based on file extension
2. Parse file content into AST
3. Walk AST recursively, collecting target node types
4. Extract name from identifier/type_identifier child nodes
5. For export statements, recurse into the wrapped declaration
6. For classes, skip recursion into body (avoids duplicating methods)
7. Fallback for unparseable files or files <= 30 lines: index as a single "module" chunk

#### 5.5.4 Chunking (`chunker.ts`)

Each parsed AST node becomes an embeddable chunk with:
- **Stable ID:** UUID v5 from `projectId:filePath:nodeType:nodeName` (deterministic across re-indexes)
- **Embed text:** `// file: {filePath}\n// {nodeType}: {nodeName}\n\n{content}` (max 8,000 chars)
- **Payload:** filePath, language, nodeType, nodeName, content, repo, orgId, projectId

#### 5.5.5 Embedding (`embedder.ts`)

- Model: `text-embedding-3-small` (OpenAI)
- Vector size: 1536 dimensions
- Batch size: 100 texts per API call
- Output: `CodeChunkPoint[]` ready for Qdrant upsert

#### 5.5.6 Architecture Generation (`architect.ts`)

After indexing, Claude Haiku analyzes the repository structure (top-level directories, file extensions, sample paths) and generates a JSON architectural summary:

```json
{
  "layers": ["Frontend", "API", "Database"],
  "rules": ["All API routes must validate input with Zod"],
  "moduleSummaries": { "src/api": "REST API endpoints" },
  "serviceRelationships": ["Frontend -> API -> Database"]
}
```

This is upserted into the `projectArchitecture` table.

#### 5.5.7 Incremental Re-indexing (`reindex.ts`)

For subsequent indexing runs (after initial indexing), ADE uses an incremental approach:

1. Compare HEAD SHA against `lastIndexedCommitSha` (early return if identical)
2. Use GitHub's compare API (`compareCommits`) to find changed/removed files
3. Delete stale chunks from Qdrant for modified/removed files
4. Re-index only changed/added files
5. Regenerate architectural summary if >20% of files changed
6. Update `lastIndexedCommitSha` to HEAD

### 5.6 Qdrant Vector Database Collections

**Code chunks collection:** `{orgId}_{projectId}`
- Vector size: 1536 (text-embedding-3-small)
- Payload: filePath, language, nodeType, nodeName, content, repo, orgId, projectId
- Filtered by projectId in search queries

**Decisions collection:** `decisions_{projectId}`
- Vector size: 1536
- Payload: projectId, orgId, goal, approach, tags

**Session summaries collection:** `sessions_{projectId}`
- Vector size: 1536
- Payload: summary, topics, createdAt, sessionId

### 5.7 GitHub Integration

**GitHub App Architecture:**
- ADE registers as a GitHub App (not OAuth app)
- Users install the app on their GitHub organization
- Installation grants access to selected repositories
- Installation ID stored in `organizations.githubInstallationId`

**Token Flow:**
1. User installs GitHub App -> callback stores `installationId` on org
2. When agent needs repo access: `@octokit/app` mints a short-lived installation token (1-hour expiry)
3. Token used for: cloning repos into sandbox, fetching file content, listing repo trees

**Critical Implementation Detail:**
```typescript
// @octokit/app v15 requires passing Octokit from @octokit/rest
// Without this, octokit.rest.apps is undefined
new App({ appId, privateKey, Octokit: Octokit });
```

### 5.8 Authentication and Multi-Tenancy

**Clerk Configuration:**
- GitHub OAuth provider for social login
- Compulsory Organizations (even solo developers must create an org)
- `proxy.ts` (Next.js 16 replaces `middleware.ts`) handles route protection

**Auth Middleware Pattern:**
```typescript
export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});
```

**Public Routes:** `/`, `/about`, `/sign-in(.*)`, `/sign-up(.*)`, `/api/github/callback`, `/api/webhooks(.*)`

**Local Development Workaround:**
- Clerk webhooks don't fire locally
- `SyncUser` component calls `POST /api/auth/sync` on every sign-in
- This route syncs both user and organization to Supabase
- GitHub App callback uses `upsert` (not `update`) for the org row to handle race conditions

### 5.9 Frontend Architecture

**Next.js 16 App Router:**
- Pages use the file-system router under `app/`
- API routes handle all Supabase queries (browser client lacks JWT template)
- `next dev --webpack` required (Turbopack doesn't support `extensionAlias` for workspace packages)

**Key Components:**
- `SyncUser`: Fires POST `/api/auth/sync` on sign-in, included in dashboard layout
- `ProjectGrid`: Main dashboard showing projects, with retry logic for GitHub connection check
- `NewProjectDialog`: Dialog to select a GitHub repo and create a project

**Real-time Streaming (planned for workspace):**
- `useStream()` from `@langchain/langgraph-sdk/react`
- Stream modes: values, messages, custom
- Custom events: `plan_step_update` (plan progress), `memoryUpdated` (memory changes)

**Workspace UI (planned):**
- Allotment panels: FileTree | Chat | DiffViewer (CodeMirror with merge view)
- PlanTimeline component: displays step-by-step plan progress

### 5.10 API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/sync` | POST | Sync Clerk user + org to Supabase |
| `/api/github/repos` | GET | List repos via GitHub App installation token |
| `/api/github/callback` | GET | GitHub App install callback, stores installationId |
| `/api/projects` | GET | List projects for current org |
| `/api/projects` | POST | Create a new project + trigger indexing job |
| `/api/projects/[id]` | GET | Fetch single project by ID (auth-gated by org) |
| `/api/projects/[id]/progress` | GET | Return indexing progress (indexedfiles, totalfiles, currentfile) |
| `/api/sessions` | GET | List sessions for a project (filtered by projectId, userId) |
| `/api/sessions` | POST | Create new session with langgraphThreadId |
| `/api/sessions/title` | POST | Generate session title from first message via GPT-4o-mini |
| `/api/sandbox/status` | GET | Health check + keep-alive for E2B sandbox (extends timeout 15 min) |
| `/api/sandbox/read-file` | POST | Read file content from E2B sandbox for editor preview |
| `/api/sandbox/commit` | POST | Commit changes to branch + create PR on GitHub |
| `/api/webhooks/clerk` | POST | Clerk webhook handler (production only) |

### 5.11 Frontend Workspace Implementation (Phase 4 - Partially Complete)

The workspace is the core development interface with three resizable panels:

**Panel Layout (Allotment):**
```
+------------------+---------------------+------------------+
|   Task Panel     |    Chat Panel       |  Editor Panel    |
|   (300px)        |    (1000px)         |  (600px)         |
|                  |                     |                  |
|  Plan steps      |  Message list       |  CodeMirror      |
|  with status     |  + Chat input       |  + Diff viewer   |
|  indicators      |  + Mode toggle      |  + Tab bar       |
+------------------+---------------------+------------------+
```

**WorkspaceProvider (`features/project/workspace-provider.tsx`):**
- React context wrapping the entire project workspace
- Manages: stream state, mode (plan/auto), tabs, sessions, sandbox, commit flow
- Integrates with LangGraph SDK's `useStream<AgentStateV2>` for real-time streaming
- Handles session creation, title generation, editor tab management
- Sandbox health checks and keep-alive (pings every 15 min)

**Chat Components:**
- `ChatPanel`: Renders conversation with empty state, integrates ChatMessageList + ChatInput
- `ChatInput`: Textarea with mode toggle (plan/auto) and submit/stop button
- Messages streamed in real-time from LangGraph agent

**Editor Components:**
- `CodeEditor`: CodeMirror 6 with syntax highlighting for JS, TS, Python, CSS, HTML, JSON
- `DiffViewer`: Unified diff display using CodeMirror merge extension
- `EditorPanel`: Tab bar + editor/diff viewer, auto-opens diffs from agent
- `EditorTabBar`: Closeable tabs for multiple open files

**Task Panel:**
- `TaskPanel`: Displays agent plan steps (from `create_todo` tool)
- `TaskStepItem`: Individual step with status indicator (pending/in_progress/completed/failed)

**Session Management:**
- Thread ID "new" creates a fresh session on first message
- Session title auto-generated from first user message via GPT-4o-mini
- Sessions listed in project sidebar navigation

**Indexing Progress Monitoring:**
- `useIndexingProgress` hook polls `/api/projects/{id}/progress` every 2 seconds
- Shows circular progress indicator on project cards during indexing
- Detects completion and triggers project list refresh

---

## 6. Implementation: Persistent Memory System

### 6.1 Four-Layer Memory Architecture

ADE's memory system is organized into four layers, each serving a different purpose:

```
Layer 4: File Evolution (instability, change patterns)
Layer 3: Decision Log (goals, approaches, rejected alternatives)
Layer 2: Architecture (layers, rules, module summaries)
Layer 1: Conventions (naming, API patterns, error handling)
```

### 6.2 Layer 1: Project Conventions (`projectConventions` table)

**What it stores:**
```typescript
interface ProjectConventionsPayload {
  namingStyle: string;         // e.g., "camelCase for variables, PascalCase for types"
  apiPattern: string;          // e.g., "REST with Express-style route handlers"
  errorPattern: string;        // e.g., "Custom Error classes with HTTP status codes"
  testingFramework: string;    // e.g., "Jest with React Testing Library"
  logging: string;             // e.g., "Winston with structured JSON logs"
  preferredLibraries: string[];// e.g., ["lodash", "axios", "zod"]
  fileStructure: string;       // e.g., "Feature-based: features/{name}/components/"
  prCount: number;             // Number of PRs that contributed to these conventions
}
```

**How it's populated:** After each PR, Claude Haiku analyzes the diff and extracts coding conventions. These are merged with existing conventions (new values overwrite matching fields).

**How it's used:** Injected into every system prompt via `buildAlwaysOnMemory()` as part of the `## Project Intelligence` block.

### 6.3 Layer 2: Project Architecture (`projectArchitecture` table)

**What it stores:**
```typescript
interface ProjectArchitecturePayload {
  layers: string[];                        // e.g., ["Frontend", "API", "Database"]
  rules: string[];                         // e.g., ["All endpoints must validate input"]
  moduleSummaries: Record<string, string>; // e.g., {"src/api": "REST endpoints"}
  serviceRelationships: string[];          // e.g., ["Frontend -> API -> Database"]
}
```

**How it's populated:**
- Initially: by `generateArchitecturalSummary()` during indexing (Claude Haiku analyzes repo structure)
- Updated: during memory extraction if structural changes detected (>20% files changed triggers re-generation)

**How it's used:** Also injected into the `## Project Intelligence` block in every system prompt.

### 6.4 Layer 3: Decision Log (`decisionLog` table + Qdrant `decisions_{projectId}`)

**What it stores:**
```typescript
interface DecisionLog {
  id: UUID;
  projectId: UUID;
  orgId: UUID;
  sessionId: UUID | null;
  prUrl: string | null;
  goal: string;                           // "Add rate limiting to API"
  approach: string;                       // "Redis-based sliding window counter"
  reasoningSummary: string;               // Why this approach was chosen
  rejectedAlternatives: RejectedAlternative[]; // What was considered and rejected
  filesModified: string[];
  tags: string[];                         // Semantic tags for categorization
  embedding: number[] | null;             // 1536-dim vector for semantic search
  importance: number;                     // 0.0-1.0, for ranking (default 0.5)
  lastReferencedAt: string | null;        // For recency boosting
  createdAt: string;
}
```

**Dual storage:** Decisions are stored in both Supabase (for structured queries) and Qdrant (for semantic vector search).

**How it's used:**
- **Proactive surfacing:** In `initNode`, the user's message is embedded and matched against past decisions (threshold > 0.85)
- **Active recall:** The `recall_memory` tool allows the agent to search decisions on-demand with 1-5 diverse queries

### 6.5 Layer 4: File Evolution (`fileEvolution` table)

**What it stores:**
```typescript
interface FileEvolution {
  id: UUID;
  projectId: UUID;
  filePath: string;
  changeCount: number;        // Total times this file was modified
  bugFixCount: number;        // Times modified for bug fixes
  coChangedWith: string[];    // Files frequently modified together
  lastChangedAt: string;
  instabilityScore: number;   // min(changeCount / 10, 1.0)
}
```

**Instability Score Formula:** `instabilityScore = min(changeCount / 10, 1.0)`

This identifies "hot" files that change frequently and may be fragile or poorly designed.

**Co-change tracking:** Every time a file is modified, all other files modified in the same PR are added to its `coChangedWith` array. This reveals implicit coupling between files.

### 6.6 Layer 5: Session Summaries (`sessionSummaries` table + Qdrant `sessions_{projectId}`)

**What it stores:**
```typescript
interface SessionSummary {
  id: UUID;
  projectId: UUID;
  orgId: UUID;
  sessionId: UUID;
  summary: string;            // Natural language summary of the session
  topics: string[];           // Key topics discussed
  decisionsReferenced: UUID[];// Decision log entries referenced
  embedding: number[] | null; // For semantic search
  createdAt: string;
}
```

**Purpose:** Enables the agent to recall what was discussed in past sessions, even when the conversation history has been discarded.

### 6.7 Memory Injection Flow

```
User sends message
    |
    v
initNode:
  1. buildAlwaysOnMemory() -> Query projectConventions + projectArchitecture
     -> Format as "## Project Intelligence" block
     -> Set as alwaysOnMemory state field

  2. surfaceRelevantMemories() -> Embed user message
     -> Search decisions (threshold > 0.85)
     -> Search session summaries (threshold > 0.85)
     -> Format as "## Relevant Context from Project History"
     -> Set as surfacedMemories state field
    |
    v
agentLoopNode:
  - System prompt = BASE_PROMPT + alwaysOnMemory (cached) + surfacedMemories
  - Agent can also call recall_memory tool for on-demand search
```

### 6.8 Memory Extraction Flow

```
Agent finishes task (with code changes)
    |
    v
memoryExtractorNode:
  1. extractAndUpdateConventions()
     -> Claude Haiku analyzes diff
     -> Extracts convention patterns
     -> Merges with existing conventions

  2. extractAndInsertDecision()
     -> Claude Haiku extracts decision record
     -> Embeds goal + approach
     -> Inserts into Supabase decisionLog
     -> Upserts into Qdrant decisions collection

  3. updateFileEvolution()
     -> For each modified file:
        -> Increment changeCount
        -> Update coChangedWith
        -> Recalculate instabilityScore
```

---

## 7. Conclusions and Future Work

### 7.1 Key Conclusions

The following conclusions can be drawn from the work completed so far:

1. **Persistent memory significantly improves AI agent performance on recurring codebases.** By accumulating conventions, architecture rules, and past decisions, the agent generates code that is increasingly aligned with the project's style and patterns over time.

2. **The ReAct (Reasoning + Acting) pattern is effective for autonomous code editing.** The single agentic loop with tool calls allows the agent to explore, plan, execute, and verify changes without requiring a rigid multi-node pipeline.

3. **Tree-sitter AST parsing produces higher-quality code chunks than naive text splitting.** By extracting semantically meaningful units (functions, classes, interfaces), the RAG system returns more relevant code context.

4. **Human-in-the-loop interrupts are essential for trust and control.** The plan approval and code review checkpoints ensure that the AI agent cannot make unreviewed changes to the codebase.

5. **Prompt caching reduces costs and latency for multi-iteration agent runs.** By caching stable system prompt blocks, API costs for cached tokens are reduced by up to 90%.

6. **A simplified single-loop architecture (v2) is more maintainable than a multi-node pipeline (v1).** The original v1 architecture with separate classifier, planner, coder, executor, reviewer nodes was replaced with a single agentLoop node that handles all tasks, reducing complexity.

7. **Cloud sandboxes (E2B) provide secure, isolated code execution.** The agent can clone repositories, make changes, and run tests without affecting the user's local environment.

8. **Multi-tenancy via Clerk Organizations provides clean data isolation.** All database queries are scoped by orgId + projectId, with Row Level Security policies enforcing access control.

### 7.2 Current Phase Status

| Phase | Status | Description |
|---|---|---|
| Phase 1 | Completed | Foundation (Turborepo, Clerk, Supabase, Qdrant, GitHub App) |
| Phase 2 | Completed | Indexing Pipeline (Tree-sitter, AST chunks, embeddings, re-index) |
| Phase 3 | Completed | Agent Core (all nodes, tools, memory injection/extraction) |
| Phase 4 | Partially Complete | Frontend Workspace — dashboard, project pages, chat panel, editor with diff viewer, task panel, session management all implemented. Remaining: final integration testing, real-time streaming polish |
| Phase 5 | Not Started | Polish (performance, UX, deployment) |

### 7.3 Future Work

The following items are planned for future semesters:

1. **Finalize Frontend Workspace (Phase 4):**
   - The core workspace UI is implemented (chat panel, editor with diff viewer, task panel, session management)
   - Remaining work: end-to-end integration testing with live LangGraph agent, streaming edge cases, mobile responsiveness

2. **Cohere Rerank Integration:**
   - Add Cohere Rerank to the QA pipeline for improved retrieval precision
   - Currently deferred; RAG uses only embedding similarity

3. **LangGraph Cloud Deployment:**
   - Deploy the agent to LangGraph Cloud (LangSmith) for production hosting
   - Currently runs in development mode via `pnpm dlx @langchain/langgraph-cli dev`

4. **PR Creation Pipeline Polish:**
   - The core `createBranchAndPR()` function exists in `packages/github/src/pulls.ts` (creates branch, applies diffs, commits, opens PR)
   - The `/api/sandbox/commit` endpoint integrates this with the E2B sandbox
   - Remaining: robust error handling, conflict resolution, PR template customization

5. **Memory Visualization and Editing:**
   - Build UI for users to view and edit the memory system
   - Implement `memoryEdits` audit trail

6. **Multi-Language Indexing:**
   - Extend Tree-sitter parser to support Go, Rust, Java, C++
   - Currently supports TypeScript, JavaScript, Python only

7. **Performance Optimization:**
   - Implement incremental embedding updates (only re-embed changed content)
   - Add Redis caching for frequently accessed memory
   - Optimize Qdrant queries with better payload indexing

8. **Security Hardening:**
   - Implement rate limiting on all API routes
   - Add input validation with Zod on all API endpoints
   - Implement CSP headers and other security best practices

---

## 8. References

*These are suggested references for the literature survey. Verify availability and add additional sources as needed.*

[1] A. Vaswani, N. Shazeer, N. Parmar, J. Uszkoreit, L. Jones, A. N. Gomez, L. Kaiser, and I. Polosukhin, "Attention is All You Need," in Advances in Neural Information Processing Systems, vol. 30, 2017.

[2] M. Chen et al., "Evaluating Large Language Models Trained on Code," arXiv preprint arXiv:2107.03374, 2021.

[3] S. Yao, J. Zhao, D. Yu, N. Du, I. Shafran, K. Narasimhan, and Y. Cao, "ReAct: Synergizing Reasoning and Acting in Language Models," in International Conference on Learning Representations (ICLR), 2023.

[4] P. Lewis, E. Perez, A. Piktus, F. Petroni, V. Karpukhin, N. Goyal, H. Kuttler, M. Lewis, W.-t. Yih, T. Rocktaschel, S. Riedel, and D. Kiela, "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks," in Advances in Neural Information Processing Systems, vol. 33, 2020.

[5] T. Schick, J. Dwivedi-Yu, R. Dessi, R. Raileanu, M. Lomeli, L. Zettlemoyer, N. Cancedda, and T. Scialom, "Toolformer: Language Models Can Teach Themselves to Use Tools," in Advances in Neural Information Processing Systems, vol. 36, 2023.

[6] C. E. Packer, S. Wooders, K. Lin, V. Fang, S. G. Patil, I. Stoica, and J. E. Gonzalez, "MemGPT: Towards LLMs as Operating Systems," arXiv preprint arXiv:2310.08560, 2023.

[7] J. Yang, C. E. Jimenez, A. Wettig, K. Lieret, S. Yao, K. Narasimhan, and O. Press, "SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering," arXiv preprint arXiv:2405.15793, 2024.

[8] M. Brunsfeld, "Tree-sitter - An incremental parsing system for programming tools," 2018. [Online]. Available: https://tree-sitter.github.io/tree-sitter/

[9] Anthropic, "Claude Model Family Documentation," 2024-2026. [Online]. Available: https://docs.anthropic.com/

[10] LangChain, "LangGraph: Framework for building agentic applications," 2024. [Online]. Available: https://github.com/langchain-ai/langgraphjs

[11] E2B, "E2B: Cloud Runtime for AI Agents," 2024. [Online]. Available: https://e2b.dev/docs

[12] Qdrant, "Qdrant: Vector Similarity Search Engine," 2024. [Online]. Available: https://qdrant.tech/documentation/

[13] Supabase, "Supabase: Open Source Firebase Alternative," 2024. [Online]. Available: https://supabase.com/docs

[14] Clerk, "Clerk: Authentication and User Management," 2024. [Online]. Available: https://clerk.com/docs

[15] OpenAI, "Embeddings API Documentation," 2024. [Online]. Available: https://platform.openai.com/docs/guides/embeddings

[16] C. E. Jimenez, J. Yang, A. Wettig, S. Yao, K. Pei, O. Press, and K. Narasimhan, "SWE-bench: Can Language Models Resolve Real-World GitHub Issues?" in International Conference on Learning Representations (ICLR), 2024.

[17] Vercel, "Next.js Documentation," 2024-2026. [Online]. Available: https://nextjs.org/docs

[18] GitHub, "GitHub Apps Documentation," 2024. [Online]. Available: https://docs.github.com/en/apps

---

## Appendix D: Deployment and DevOps

### D.1 Docker Configuration (Agent Service)

The LangGraph agent is containerized for production deployment:

```dockerfile
FROM langchain/langgraphjs-api:20
ADD . /deps/agent
ENV LANGSERVE_GRAPHS='{"ade-agent":"./apps/agent/src/agent/graph.ts:graph"}'
WORKDIR /deps/agent
RUN corepack enable && pnpm install --frozen-lockfile --filter @workspace/agent...
```

- Base image: LangGraph API v20 (includes LangGraph Cloud runtime)
- Builds from monorepo root with pnpm workspace filtering
- Exports the compiled graph as `ade-agent` for LangGraph Cloud discovery

### D.2 Error Monitoring (Sentry)

Sentry is integrated into the Next.js frontend for error tracking:

- **DSN:** Configured for both server and edge runtimes
- **Trace Sample Rate:** 1.0 (100% of requests traced)
- **Features:** `enableLogs=true`, `sendDefaultPii=true`
- **Tunnel Route:** `/monitoring` (bypasses ad blockers)
- **Runtime Instrumentation:** Separate configs for Node.js (`sentry.server.config.ts`) and Edge (`sentry.edge.config.ts`)
- `instrumentation.ts` registers the appropriate config based on runtime

### D.3 Agent Observability (LangSmith)

All LLM calls and agent iterations are traced via LangSmith:

- **Endpoint:** `https://api.smith.langchain.com`
- **Project:** "NexGenesis ADE"
- **Tracing:** Enabled by default (`LANGSMITH_TRACING=true`)
- Provides: latency tracking, token usage, tool call visualization, error debugging

### D.4 Infrastructure Hosting

| Service | Platform |
|---|---|
| Frontend (Next.js) | Vercel (planned) |
| Agent (LangGraph) | LangGraph Cloud / Docker on Railway |
| Database (PostgreSQL) | Supabase Cloud |
| Vector DB (Qdrant) | Railway (Docker) |
| Redis Cache | Railway |
| GitHub App | GitHub.com |
| Auth | Clerk Cloud |

---

## Appendix A: Database Schema

### A.1 Complete SQL Schema (6 Migrations)

#### Migration 0001: Initial Schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- Users synced from Clerk
CREATE TABLE users (
  id UUID PRIMARY KEY,
  clerkId TEXT UNIQUE NOT NULL,
  githubUsername TEXT,
  githubAccessToken TEXT,
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
  indexStatus TEXT DEFAULT 'pending',
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
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Generated code waiting for PR
CREATE TABLE pendingChanges (
  id UUID PRIMARY KEY,
  sessionId UUID REFERENCES sessions(id),
  projectId UUID REFERENCES projects(id),
  diffs JSONB NOT NULL,
  prUrl TEXT,
  status TEXT DEFAULT 'pending',
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing job progress (for realtime updates)
CREATE TABLE indexingJobs (
  id UUID PRIMARY KEY,
  projectId UUID REFERENCES projects(id),
  status TEXT DEFAULT 'running',
  totalFiles INT,
  indexedFiles INT DEFAULT 0,
  currentFile TEXT,
  error TEXT,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Layer 1: Project Conventions Memory
CREATE TABLE projectConventions (
  id UUID PRIMARY KEY,
  projectId UUID REFERENCES projects(id),
  orgId UUID REFERENCES organizations(id),
  conventions JSONB NOT NULL,
  lastUpdatedAt TIMESTAMPTZ DEFAULT NOW(),
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Layer 2: Architectural Memory
CREATE TABLE projectArchitecture (
  id UUID PRIMARY KEY,
  projectId UUID REFERENCES projects(id),
  orgId UUID REFERENCES organizations(id),
  architecture JSONB NOT NULL,
  lastUpdatedAt TIMESTAMPTZ DEFAULT NOW(),
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Layer 3: Decision Memory
CREATE TABLE decisionLog (
  id UUID PRIMARY KEY,
  projectId UUID REFERENCES projects(id),
  orgId UUID REFERENCES organizations(id),
  sessionId UUID REFERENCES sessions(id),
  prUrl TEXT,
  goal TEXT NOT NULL,
  approach TEXT NOT NULL,
  reasoningSummary TEXT NOT NULL,
  rejectedAlternatives JSONB,
  filesModified TEXT[],
  tags TEXT[],
  embedding VECTOR(1536),
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Layer 4: Evolution Tracking
CREATE TABLE fileEvolution (
  id UUID PRIMARY KEY,
  projectId UUID REFERENCES projects(id),
  filePath TEXT NOT NULL,
  changeCount INT DEFAULT 0,
  bugFixCount INT DEFAULT 0,
  coChangedWith TEXT[],
  lastChangedAt TIMESTAMPTZ,
  instabilityScore FLOAT DEFAULT 0,
  UNIQUE(projectId, filePath)
);

-- Memory edits by users
CREATE TABLE memoryEdits (
  id UUID PRIMARY KEY,
  projectId UUID REFERENCES projects(id),
  userId UUID REFERENCES users(id),
  memoryType TEXT NOT NULL,
  memoryId UUID NOT NULL,
  before JSONB,
  after JSONB,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);
```

#### Migration 0002a: GitHub Installation on Organizations
```sql
ALTER TABLE organizations ADD COLUMN githubInstallationId BIGINT;
```

#### Migration 0002b: Row Level Security
- RLS enabled on ALL tables
- Helper functions: `requesting_clerk_user_id()` (JWT `sub` claim), `requesting_clerk_org_id()` (JWT `org_id` claim)
- Policies: users (self-scoped), organizations (org-scoped), projects/sessions/messages/pendingChanges (org/user-scoped)
- indexingJobs, projectConventions, projectArchitecture, decisionLog, fileEvolution, memoryEdits (org-scoped read, service role write)

#### Migration 0003: GitHub Installation on Projects
```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS githubInstallationId BIGINT;
```

#### Migration 0004: Indexed Commit SHA
```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS lastIndexedCommitSha TEXT;
```

#### Migration 0005: Unique Constraints
```sql
ALTER TABLE projectarchitecture ADD CONSTRAINT projectarchitecture_projectid_key UNIQUE (projectid);
ALTER TABLE fileevolution ADD CONSTRAINT fileevolution_projectid_filepath_key UNIQUE (projectid, filepath);
```

#### Migration 0006: Session Summaries and Decision Enhancements
```sql
CREATE TABLE sessionsummaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projectid UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  orgid UUID NOT NULL,
  sessionid UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  topics TEXT[] DEFAULT '{}',
  decisionsreferenced UUID[] DEFAULT '{}',
  embedding FLOAT8[],
  createdat TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE decisionlog ADD COLUMN IF NOT EXISTS importance FLOAT8 DEFAULT 0.5;
ALTER TABLE decisionlog ADD COLUMN IF NOT EXISTS lastreferencedat TIMESTAMPTZ;
```

### A.2 Entity-Relationship Description

**Core entities and relationships:**
- Organization (1) -> (N) Projects
- Project (1) -> (N) Sessions
- Session (1) -> (N) Messages
- Session (1) -> (N) PendingChanges
- Project (1) -> (N) IndexingJobs
- Project (1) -> (1) ProjectConventions
- Project (1) -> (1) ProjectArchitecture
- Project (1) -> (N) DecisionLog entries
- Project (1) -> (N) FileEvolution entries
- Project (1) -> (N) SessionSummaries
- User (1) -> (N) Sessions
- User (1) -> (N) MemoryEdits

---

## Appendix B: Complete Type Definitions

### B.1 Enumerations

```typescript
type TaskType = "qa" | "simpleFix" | "multiStep" | "review";
type MessageRole = "user" | "assistant" | "tool";
type PlanStepStatus = "pending" | "in_progress" | "completed" | "failed";
type IndexStatus = "pending" | "indexing" | "ready" | "failed";
type IndexingJobStatus = "running" | "complete" | "failed";
type PendingChangeStatus = "pending" | "pr_created";
type MemoryType = "conventions" | "architecture" | "decision";
type MemoryExtractionStatus = "pending" | "running" | "done" | null;
type AgentMode = "plan" | "auto";
```

### B.2 Core Data Types

```typescript
interface PlanStep {
  step: string;           // Short label
  file: string;           // Primary file affected
  action: "create" | "edit" | "delete" | string;
  description: string;    // What this step does
  status: PlanStepStatus; // Live execution status streamed to frontend
}

interface FileDiff {
  file: string;           // File path
  patch: string;          // Unified diff patch
}

interface CodeChunk {
  filePath: string;
  language: string;
  nodeType: string;
  nodeName: string;
  content: string;
  score?: number;
}

interface ExecutionResult {
  success: boolean;
  output: string;
  errors: string[];
}

interface ReviewResult {
  approved: boolean;
  feedback: string;
}
```

### B.3 Agent State (v2)

```typescript
interface AgentStateV2 {
  sessionId: string;
  projectId: string;
  orgId: string;
  messages: unknown[];
  mode: AgentMode;                    // "plan" or "auto"
  sandboxId: string | null;
  alwaysOnMemory: string;             // Conventions + architecture
  surfacedMemories: string;           // Proactively surfaced past context
  iterationCount: number;             // Current loop iteration
  finished: boolean;                  // True when task is done
  generatedDiffs: FileDiff[];         // Code changes captured from sandbox
  plan: PlanStep[] | null;            // Optional execution plan
  memoryExtractionStatus: MemoryExtractionStatus;
}
```

### B.4 Database Type Integration

```typescript
interface Database {
  public: {
    Tables: {
      users: TableDef<User>;
      organizations: TableDef<Organization>;
      projects: TableDef<Project>;
      sessions: TableDef<Session>;
      messages: TableDef<Message>;
      pendingChanges: TableDef<PendingChange>;
      indexingJobs: TableDef<IndexingJob>;
      projectConventions: TableDef<ProjectConventions>;
      projectArchitecture: TableDef<ProjectArchitecture>;
      decisionLog: TableDef<DecisionLog>;
      fileEvolution: TableDef<FileEvolution>;
      memoryEdits: TableDef<MemoryEdit>;
      sessionSummaries: TableDef<SessionSummary>;
    };
  };
}
```

---

## Appendix C: Agent System Prompts and Tool Schemas

### C.1 Base System Prompt (agentLoopNode)

```
You are ADE, an expert AI coding agent with direct access to a project repository
via an E2B sandbox. You gather context, take action, verify results, and iterate
until the task is done.

## Your Approach
1. Understand: Read the user's request carefully. Recall relevant memories if the
   task references past work.
2. Explore: Read files, search code, list directories to understand the current state.
3. Plan (if complex): For multi-file changes, create a plan with create_plan.
   In plan mode, call request_plan_approval.
4. Execute: Make changes with edit_file (preferred) or write_file. One logical
   change at a time.
5. Verify: Run tests, type-check, or read the changed file to confirm correctness.
6. Iterate: If something breaks, fix it. Keep going until the task is fully done.
7. Finish: Call finish() when done. For code changes, call request_review_approval first.

## When to Use recall_memory
- When the user references something from a past conversation or decision
- When you need to understand why a past decision was made
- When you're unsure about a convention or pattern in this project

## CRITICAL: Tool Repetition Rules
- NEVER call the same tool more than 3 times with similar arguments.
- If search_code returns irrelevant results, switch to search_files or list_directory.
- If you cannot find what you need after 2-3 attempts, stop and ask the user.

## Rules
- Follow all project conventions in the Project Intelligence block strictly
- Never make changes beyond what the task requires
- Read a file before editing it
- Use edit_file for targeted edits, write_file for new files
- Run tests after making changes to verify correctness
```

### C.2 Plan Mode System Prompt Addition

```
## MODE: PLAN
You are in plan mode. You can ONLY use read-only tools (read_file, list_directory,
glob, search_files, search_code, recall_memory). Explore the codebase, understand
the task, then create a plan with create_plan and call request_plan_approval.
Do NOT make any edits.
```

### C.3 Convention Extraction Prompt (Memory Extractor)

```
Extract coding conventions from this PR diff. Return JSON only with these optional
fields: { "namingStyle": string, "apiPattern": string, "errorPattern": string,
"testingFramework": string, "logging": string, "preferredLibraries": string[],
"fileStructure": string }. Only include fields you can confidently infer.
Return {} if nothing notable.
```

### C.4 Decision Extraction Prompt (Memory Extractor)

```
Extract the engineering decision from this PR. Return JSON only:
{ "goal": string, "approach": string, "reasoningSummary": string,
"rejectedAlternatives": [{"approach": string, "reasonRejected": string}],
"tags": string[] }
```

### C.5 Architecture Generation Prompt

```
You are analyzing a GitHub repository to extract its architectural summary.

Repository: {repoFullName}
Top-level directories: {dirs}
File extensions: {extensions}
Total files: {count}

Sample file paths:
{paths}

Return JSON only:
{
  "layers": ["string"],
  "rules": ["string"],
  "moduleSummaries": { "dir": "one-sentence description" },
  "serviceRelationships": ["string"]
}
```

### C.6 Conversation Compaction Prompt

```
Summarize this conversation history concisely. Preserve ALL of the following:
- Decisions made and their reasoning
- Files read, created, or modified
- Errors encountered and how they were resolved
- Outstanding tasks or next steps
- User preferences expressed
Be concise but complete. Use bullet points.
```

---

## Appendix D: Environment Variables Required

| Variable | Service | Purpose |
|---|---|---|
| `SUPABASE_URL` | Supabase | PostgreSQL database URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Service role key (bypasses RLS) |
| `SUPABASE_ANON_KEY` | Supabase | Anonymous key (for frontend) |
| `QDRANT_URL` | Qdrant | Vector database URL |
| `QDRANT_API_KEY` | Qdrant | API key for authentication |
| `OPENAI_API_KEY` | OpenAI | For text-embedding-3-small |
| `ANTHROPIC_API_KEY` | Anthropic | For Claude Sonnet and Haiku |
| `E2B_API_KEY` | E2B | For cloud sandbox creation |
| `GITHUB_APP_ID` | GitHub | GitHub App ID |
| `GITHUB_APP_PRIVATE_KEY` | GitHub | GitHub App private key (PEM) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | Frontend auth |
| `CLERK_SECRET_KEY` | Clerk | Backend auth |
| `CLERK_WEBHOOK_SECRET` | Clerk | Webhook signature verification |
| `SENTRY_AUTH_TOKEN` | Sentry | Error monitoring + source map upload |
| `LANGSMITH_API_KEY` | LangSmith | Agent tracing and hosting |
| `LANGSMITH_TRACING` | LangSmith | Enable/disable tracing (true/false) |
| `LANGSMITH_ENDPOINT` | LangSmith | API endpoint (https://api.smith.langchain.com) |
| `LANGSMITH_PROJECT` | LangSmith | Project name ("NexGenesis ADE") |
| `NEXT_PUBLIC_LANGGRAPH_API_URL` | LangGraph | Agent API URL (http://localhost:2024 in dev) |
| `NEXT_PUBLIC_APP_URL` | Next.js | Application URL (http://localhost:3000 in dev) |
| `NEXT_PUBLIC_GITHUB_APP_PUBLIC_LINK` | GitHub | Public install link for GitHub App |
| `REDIS_URI` | Redis | Cache backend (Railway hosted) |
| `DATABASE_URI` | PostgreSQL | Direct connection string (pooled) |

---

*End of specification. This document contains all information needed to generate a comprehensive academic project report.*
