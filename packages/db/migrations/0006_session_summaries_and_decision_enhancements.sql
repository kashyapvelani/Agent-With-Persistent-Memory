-- ============================================================
-- 0006_session_summaries_and_decision_enhancements.sql
--
-- Agent v2 memory system:
-- 1. New sessionSummaries table for long-term session recall
-- 2. Add importance + lastReferencedAt to decisionLog for ranking
-- ============================================================

-- ── 1. Session Summaries table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessionsummaries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projectid   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  orgid       UUID NOT NULL,
  sessionid   UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  summary     TEXT NOT NULL,
  topics      TEXT[] DEFAULT '{}',
  decisionsreferenced UUID[] DEFAULT '{}',
  embedding   FLOAT8[],
  createdat   TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by project
CREATE INDEX IF NOT EXISTS idx_sessionsummaries_projectid
  ON sessionsummaries(projectid);

-- Index for lookups by session
CREATE INDEX IF NOT EXISTS idx_sessionsummaries_sessionid
  ON sessionsummaries(sessionid);

-- One summary per session
ALTER TABLE sessionsummaries
  ADD CONSTRAINT sessionsummaries_sessionid_key UNIQUE (sessionid);

-- ── 2. Decision log enhancements ────────────────────────────────────────────

-- Importance score for ranking recalled memories (0.0 - 1.0)
ALTER TABLE decisionlog
  ADD COLUMN IF NOT EXISTS importance FLOAT8 DEFAULT 0.5;

-- Track when a decision was last referenced (for recency boosting)
ALTER TABLE decisionlog
  ADD COLUMN IF NOT EXISTS lastreferencedat TIMESTAMPTZ;

-- ── 3. RLS (Row Level Security) ─────────────────────────────────────────────

ALTER TABLE sessionsummaries ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (agent runs with service role)
CREATE POLICY sessionsummaries_service_all
  ON sessionsummaries
  FOR ALL
  USING (true)
  WITH CHECK (true);
