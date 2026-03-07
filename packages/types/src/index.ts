export type UUID = string;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export type TaskType = "qa" | "simpleFix" | "multiStep" | "review";
export type MessageRole = "user" | "assistant" | "tool";
export type PlanStepStatus = "pending" | "in_progress" | "completed" | "failed";
export type IndexStatus = "pending" | "indexing" | "ready" | "failed";
export type IndexingJobStatus = "running" | "complete" | "failed";
export type PendingChangeStatus = "pending" | "pr_created";
export type MemoryType = "conventions" | "architecture" | "decision";
export type MemoryExtractionStatus = "pending" | "running" | "done" | null;

export interface ProjectRef {
  orgId: UUID;
  projectId: UUID;
}

export interface RejectedAlternative {
  approach: string;
  reasonRejected: string;
}

export interface ProjectConventionsPayload {
  namingStyle: string;
  apiPattern: string;
  errorPattern: string;
  testingFramework: string;
  logging: string;
  preferredLibraries: string[];
  fileStructure: string;
  prCount: number;
}

export interface ProjectArchitecturePayload {
  layers: string[];
  rules: string[];
  moduleSummaries: Record<string, string>;
  serviceRelationships: string[];
}

export interface DecisionRecordPayload {
  goal: string;
  approach: string;
  reasoningSummary: string;
  rejectedAlternatives: RejectedAlternative[];
  tags: string[];
}

export interface User {
  id: UUID;
  clerkId: string;
  githubUsername: string | null;
  githubAccessToken: string | null;
  email: string | null;
  createdAt: string;
}

export interface Organization {
  id: UUID;
  clerkOrgId: string;
  name: string;
  createdAt: string;
}

export interface Project {
  id: UUID;
  orgId: UUID;
  ownerId: UUID;
  repoFullName: string;
  repoUrl: string;
  defaultBranch: string;
  indexStatus: IndexStatus;
  lastIndexedAt: string | null;
  lastIndexedCommitSha: string | null;
  githubInstallationId: number | null;
  createdAt: string;
}

export interface Session {
  id: UUID;
  projectId: UUID;
  userId: UUID;
  langgraphThreadId: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: UUID;
  sessionId: UUID;
  role: MessageRole;
  content: string;
  metadata: JsonValue;
  createdAt: string;
}

export interface FileDiff {
  file: string;
  patch: string;
}

export interface PendingChange {
  id: UUID;
  sessionId: UUID;
  projectId: UUID;
  diffs: FileDiff[];
  prUrl: string | null;
  status: PendingChangeStatus;
  createdAt: string;
}

export interface IndexingJob {
  id: UUID;
  projectId: UUID;
  status: IndexingJobStatus;
  totalFiles: number | null;
  indexedFiles: number;
  currentFile: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectConventions {
  id: UUID;
  projectId: UUID;
  orgId: UUID;
  conventions: ProjectConventionsPayload;
  lastUpdatedAt: string;
  createdAt: string;
}

export interface ProjectArchitecture {
  id: UUID;
  projectId: UUID;
  orgId: UUID;
  architecture: ProjectArchitecturePayload;
  lastUpdatedAt: string;
  createdAt: string;
}

export interface DecisionLog {
  id: UUID;
  projectId: UUID;
  orgId: UUID;
  sessionId: UUID | null;
  prUrl: string | null;
  goal: string;
  approach: string;
  reasoningSummary: string;
  rejectedAlternatives: RejectedAlternative[];
  filesModified: string[];
  tags: string[];
  embedding: number[] | null;
  createdAt: string;
}

export interface FileEvolution {
  id: UUID;
  projectId: UUID;
  filePath: string;
  changeCount: number;
  bugFixCount: number;
  coChangedWith: string[];
  lastChangedAt: string | null;
  instabilityScore: number;
}

export interface MemoryEdit {
  id: UUID;
  projectId: UUID;
  userId: UUID;
  memoryType: MemoryType;
  memoryId: UUID;
  before: JsonValue;
  after: JsonValue;
  createdAt: string;
}

export interface PlanStep {
  step: string;
  file: string;
  action: "create" | "edit" | "delete" | string;
  description: string;
  status: PlanStepStatus; // live execution status — streamed to frontend
}

export interface CodeChunk {
  filePath: string;
  language: string;
  nodeType: string;
  nodeName: string;
  content: string;
  score?: number;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  errors: string[];
}

export interface ReviewResult {
  approved: boolean;
  feedback: string;
}

export interface AgentState {
  sessionId: string;
  projectId: string;
  orgId: string;
  messages: unknown[];
  taskType: TaskType;
  plan: PlanStep[] | null;
  currentStepIndex: number;
  retrievedChunks: CodeChunk[];
  memoryContext: string | null;
  sandboxId: string | null;
  generatedDiffs: FileDiff[];
  executionResult: ExecutionResult | null;
  reviewResult: ReviewResult | null;
  retryCount: number;
  memoryExtractionStatus: MemoryExtractionStatus;
}

export interface CreateProjectInput {
  orgId: UUID;
  repoFullName: string;
  repoUrl: string;
  defaultBranch?: string;
}

export interface MemoryUpdatedEvent {
  type: "memoryUpdated";
  projectId: UUID;
}

// Intersecting with Record<string, unknown> satisfies supabase-js's GenericTable
// constraint without using "extends Record<string, unknown>" on T, which would
// collapse interface types (no index signature) to never.
type TableDef<T> = {
  Row: T & Record<string, unknown>;
  Insert: Partial<T> & Record<string, unknown>;
  Update: Partial<T> & Record<string, unknown>;
  Relationships: [];
};

export interface Database {
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
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
