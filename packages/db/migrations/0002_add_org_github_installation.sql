-- Add GitHub App installation ID to organizations
-- This stores the installation at the org level so all projects under the org can use it
ALTER TABLE organizations ADD COLUMN githubInstallationId BIGINT;