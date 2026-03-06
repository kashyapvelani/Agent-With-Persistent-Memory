-- ============================================================
-- 0003_github_installation.sql
-- Adds GitHub App installation tracking to projects.
-- ============================================================

-- GitHub App installation ID for this repo.
-- Set when the user installs the GitHub App and authorises the repo.
-- Used at runtime to mint per-installation Octokit tokens via @octokit/app.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS githubInstallationId BIGINT;
