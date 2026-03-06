-- ============================================================
-- 0004_indexed_commit_sha.sql
-- Tracks which commit was last fully indexed per project.
-- Used by the incremental re-index to compute the git diff.
-- ============================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS lastIndexedCommitSha TEXT;
