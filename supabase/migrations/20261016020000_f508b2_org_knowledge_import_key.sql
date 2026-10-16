-- F-508b2: stable key for `pnpm knowledge:import`, so re-running a file updates the same row (a new version) instead of adding one.
-- Nullable: rows written in the app have no key. Unique per org; NULLs never collide. The stamp trigger ignores it, so setting it bumps no version.
ALTER TABLE org_knowledge ADD COLUMN import_key text CHECK (char_length(btrim(import_key)) BETWEEN 1 AND 100),
  ADD CONSTRAINT org_knowledge_import_key_uniq UNIQUE (org_id, import_key);
