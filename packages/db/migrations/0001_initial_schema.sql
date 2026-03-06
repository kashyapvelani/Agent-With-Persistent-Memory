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
