-- ============================================================
-- 0005_unique_constraints.sql
-- Fixes two constraint issues from the initial schema:
--
-- 1. projectArchitecture needs UNIQUE(projectId) so upserts work.
-- 2. fileEvolution had UNIQUE(projectId, file_path) which referenced a
--    non-existent column name — PostgreSQL stored the column as "filepath"
--    (unquoted camelCase is lowercased). Drop the bad constraint and
--    re-create it with the correct (lowercased) column name.
-- ============================================================

-- Fix 1: one architecture summary per project
ALTER TABLE projectarchitecture
  ADD CONSTRAINT projectarchitecture_projectid_key UNIQUE (projectid);

-- Fix 2: re-create the file evolution uniqueness with correct column name
ALTER TABLE fileevolution
  DROP CONSTRAINT IF EXISTS fileevolution_projectid_filepath_key;

ALTER TABLE fileevolution
  ADD CONSTRAINT fileevolution_projectid_filepath_key UNIQUE (projectid, filepath);
