-- ============================================================
-- 0002_rls.sql — Row Level Security Policies
-- ============================================================
-- Prerequisites:
--   0001_initial_schema.sql must be applied first.
--
-- Auth setup (one-time, in Supabase dashboard):
--   Project Settings → Integrations → Third-Party Auth → Add → Clerk
--   Paste your Clerk domain (e.g. https://example.clerk.accounts.dev)
--
-- Clerk JWT customization (Clerk dashboard → Sessions → Customize session token):
--   Add claim:  "role": "authenticated"
--   This is required so Supabase recognises the token as the authenticated role.
--
-- No JWT secret sharing required. Supabase verifies Clerk tokens automatically
-- via the Clerk JWKS endpoint.
-- ============================================================

-- ----------------------------------------
-- Helper: Clerk user ID  (JWT `sub` claim)
-- ----------------------------------------
CREATE OR REPLACE FUNCTION requesting_clerk_user_id()
RETURNS TEXT
LANGUAGE SQL STABLE
AS $$
  SELECT (auth.jwt() ->> 'sub');
$$;

-- ----------------------------------------
-- Helper: Clerk org ID  (JWT `org_id` claim — supports both long and short forms)
-- ----------------------------------------
CREATE OR REPLACE FUNCTION requesting_clerk_org_id()
RETURNS TEXT
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'org_id',
    auth.jwt() -> 'o' ->> 'id'
  );
$$;

-- ----------------------------------------
-- Enable RLS on every table
-- ----------------------------------------

ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE pendingchanges      ENABLE ROW LEVEL SECURITY;
ALTER TABLE indexingjobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE projectconventions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE projectarchitecture ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisionlog         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fileevolution       ENABLE ROW LEVEL SECURITY;
ALTER TABLE memoryedits         ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES
-- ============================================================

-- ----------------------------------------
-- users
-- ----------------------------------------

CREATE POLICY "users: self read"
  ON users FOR SELECT
  TO authenticated
  USING (clerkid = requesting_clerk_user_id());

CREATE POLICY "users: self insert"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (clerkid = requesting_clerk_user_id());

CREATE POLICY "users: self update"
  ON users FOR UPDATE
  TO authenticated
  USING (clerkid = requesting_clerk_user_id());

-- ----------------------------------------
-- organizations
-- ----------------------------------------

CREATE POLICY "organizations: org members read"
  ON organizations FOR SELECT
  TO authenticated
  USING (clerkorgid = requesting_clerk_org_id());

CREATE POLICY "organizations: org members insert"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (clerkorgid = requesting_clerk_org_id());

-- ----------------------------------------
-- projects  (org-scoped)
-- ----------------------------------------

CREATE POLICY "projects: org members read"
  ON projects FOR SELECT
  TO authenticated
  USING (
    orgid IN (
      SELECT id FROM organizations
      WHERE clerkorgid = requesting_clerk_org_id()
    )
  );

CREATE POLICY "projects: org members insert"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (
    orgid IN (
      SELECT id FROM organizations
      WHERE clerkorgid = requesting_clerk_org_id()
    )
  );

CREATE POLICY "projects: org members update"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    orgid IN (
      SELECT id FROM organizations
      WHERE clerkorgid = requesting_clerk_org_id()
    )
  );

CREATE POLICY "projects: org members delete"
  ON projects FOR DELETE
  TO authenticated
  USING (
    orgid IN (
      SELECT id FROM organizations
      WHERE clerkorgid = requesting_clerk_org_id()
    )
  );

-- ----------------------------------------
-- sessions  (user-scoped)
-- ----------------------------------------

CREATE POLICY "sessions: owner read"
  ON sessions FOR SELECT
  TO authenticated
  USING (
    userid IN (
      SELECT id FROM users WHERE clerkid = requesting_clerk_user_id()
    )
  );

CREATE POLICY "sessions: owner insert"
  ON sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    userid IN (
      SELECT id FROM users WHERE clerkid = requesting_clerk_user_id()
    )
  );

CREATE POLICY "sessions: owner update"
  ON sessions FOR UPDATE
  TO authenticated
  USING (
    userid IN (
      SELECT id FROM users WHERE clerkid = requesting_clerk_user_id()
    )
  );

-- ----------------------------------------
-- messages  (session-owner-scoped)
-- ----------------------------------------

CREATE POLICY "messages: session owner read"
  ON messages FOR SELECT
  TO authenticated
  USING (
    sessionid IN (
      SELECT s.id FROM sessions s
      JOIN users u ON u.id = s.userid
      WHERE u.clerkid = requesting_clerk_user_id()
    )
  );

CREATE POLICY "messages: session owner insert"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sessionid IN (
      SELECT s.id FROM sessions s
      JOIN users u ON u.id = s.userid
      WHERE u.clerkid = requesting_clerk_user_id()
    )
  );

-- ----------------------------------------
-- pendingChanges  (session-owner-scoped)
-- ----------------------------------------

CREATE POLICY "pendingchanges: session owner read"
  ON pendingchanges FOR SELECT
  TO authenticated
  USING (
    sessionid IN (
      SELECT s.id FROM sessions s
      JOIN users u ON u.id = s.userid
      WHERE u.clerkid = requesting_clerk_user_id()
    )
  );

CREATE POLICY "pendingchanges: session owner insert"
  ON pendingchanges FOR INSERT
  TO authenticated
  WITH CHECK (
    sessionid IN (
      SELECT s.id FROM sessions s
      JOIN users u ON u.id = s.userid
      WHERE u.clerkid = requesting_clerk_user_id()
    )
  );

CREATE POLICY "pendingchanges: session owner update"
  ON pendingchanges FOR UPDATE
  TO authenticated
  USING (
    sessionid IN (
      SELECT s.id FROM sessions s
      JOIN users u ON u.id = s.userid
      WHERE u.clerkid = requesting_clerk_user_id()
    )
  );

-- ----------------------------------------
-- indexingJobs  (org-scoped read; agent writes via service role)
-- ----------------------------------------

CREATE POLICY "indexingjobs: org members read"
  ON indexingjobs FOR SELECT
  TO authenticated
  USING (
    projectid IN (
      SELECT p.id FROM projects p
      JOIN organizations o ON o.id = p.orgid
      WHERE o.clerkorgid = requesting_clerk_org_id()
    )
  );

-- ----------------------------------------
-- projectConventions  (org-scoped)
-- ----------------------------------------

CREATE POLICY "projectconventions: org members read"
  ON projectconventions FOR SELECT
  TO authenticated
  USING (
    orgid IN (
      SELECT id FROM organizations WHERE clerkorgid = requesting_clerk_org_id()
    )
  );

CREATE POLICY "projectconventions: org members insert"
  ON projectconventions FOR INSERT
  TO authenticated
  WITH CHECK (
    orgid IN (
      SELECT id FROM organizations WHERE clerkorgid = requesting_clerk_org_id()
    )
  );

CREATE POLICY "projectconventions: org members update"
  ON projectconventions FOR UPDATE
  TO authenticated
  USING (
    orgid IN (
      SELECT id FROM organizations WHERE clerkorgid = requesting_clerk_org_id()
    )
  );

-- ----------------------------------------
-- projectArchitecture  (org-scoped)
-- ----------------------------------------

CREATE POLICY "projectarchitecture: org members read"
  ON projectarchitecture FOR SELECT
  TO authenticated
  USING (
    orgid IN (
      SELECT id FROM organizations WHERE clerkorgid = requesting_clerk_org_id()
    )
  );

CREATE POLICY "projectarchitecture: org members insert"
  ON projectarchitecture FOR INSERT
  TO authenticated
  WITH CHECK (
    orgid IN (
      SELECT id FROM organizations WHERE clerkorgid = requesting_clerk_org_id()
    )
  );

CREATE POLICY "projectarchitecture: org members update"
  ON projectarchitecture FOR UPDATE
  TO authenticated
  USING (
    orgid IN (
      SELECT id FROM organizations WHERE clerkorgid = requesting_clerk_org_id()
    )
  );

-- ----------------------------------------
-- decisionLog  (org-scoped)
-- ----------------------------------------

CREATE POLICY "decisionlog: org members read"
  ON decisionlog FOR SELECT
  TO authenticated
  USING (
    orgid IN (
      SELECT id FROM organizations WHERE clerkorgid = requesting_clerk_org_id()
    )
  );

CREATE POLICY "decisionlog: org members insert"
  ON decisionlog FOR INSERT
  TO authenticated
  WITH CHECK (
    orgid IN (
      SELECT id FROM organizations WHERE clerkorgid = requesting_clerk_org_id()
    )
  );

CREATE POLICY "decisionlog: org members update"
  ON decisionlog FOR UPDATE
  TO authenticated
  USING (
    orgid IN (
      SELECT id FROM organizations WHERE clerkorgid = requesting_clerk_org_id()
    )
  );

CREATE POLICY "decisionlog: org members delete"
  ON decisionlog FOR DELETE
  TO authenticated
  USING (
    orgid IN (
      SELECT id FROM organizations WHERE clerkorgid = requesting_clerk_org_id()
    )
  );

-- ----------------------------------------
-- fileEvolution  (org-scoped via project)
-- ----------------------------------------

CREATE POLICY "fileevolution: org members read"
  ON fileevolution FOR SELECT
  TO authenticated
  USING (
    projectid IN (
      SELECT p.id FROM projects p
      JOIN organizations o ON o.id = p.orgid
      WHERE o.clerkorgid = requesting_clerk_org_id()
    )
  );

CREATE POLICY "fileevolution: org members insert"
  ON fileevolution FOR INSERT
  TO authenticated
  WITH CHECK (
    projectid IN (
      SELECT p.id FROM projects p
      JOIN organizations o ON o.id = p.orgid
      WHERE o.clerkorgid = requesting_clerk_org_id()
    )
  );

CREATE POLICY "fileevolution: org members update"
  ON fileevolution FOR UPDATE
  TO authenticated
  USING (
    projectid IN (
      SELECT p.id FROM projects p
      JOIN organizations o ON o.id = p.orgid
      WHERE o.clerkorgid = requesting_clerk_org_id()
    )
  );

-- ----------------------------------------
-- memoryEdits  (org-scoped read; user-scoped insert)
-- ----------------------------------------

CREATE POLICY "memoryedits: org members read"
  ON memoryedits FOR SELECT
  TO authenticated
  USING (
    projectid IN (
      SELECT p.id FROM projects p
      JOIN organizations o ON o.id = p.orgid
      WHERE o.clerkorgid = requesting_clerk_org_id()
    )
  );

CREATE POLICY "memoryedits: user insert"
  ON memoryedits FOR INSERT
  TO authenticated
  WITH CHECK (
    userid IN (
      SELECT id FROM users WHERE clerkid = requesting_clerk_user_id()
    )
    AND projectid IN (
      SELECT p.id FROM projects p
      JOIN organizations o ON o.id = p.orgid
      WHERE o.clerkorgid = requesting_clerk_org_id()
    )
  );
