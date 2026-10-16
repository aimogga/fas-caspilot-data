-- F-508b: what FAS tells the grant writer about itself. Drafts quote only these rows and cite `org_knowledge:<id>@v<version>`.
-- No delete: rows are archived, and every insert or edit writes an immutable snapshot to org_knowledge_version so a citation always resolves.
-- The full privacy guard is lib/knowledge/guard.ts (server-side, before every write); the CHECKs below are the database backstop.
CREATE TABLE org_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES org(id),
  category text NOT NULL CHECK (category IN ('mission','program','service_model','staffing','budget','eligibility','outcome','boilerplate','other')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200), body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 8000),
  source text, as_of date, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','archived')),
  created_by uuid, approved_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1, UNIQUE (id, org_id),
  CONSTRAINT org_knowledge_numbers_sourced CHECK (category NOT IN ('outcome','budget') OR body !~ '[0-9]' OR (nullif(btrim(source), '') IS NOT NULL AND as_of IS NOT NULL)),
  CONSTRAINT org_knowledge_no_ssn_email CHECK (body !~ '\m[0-9]{3}[- ][0-9]{2}[- ][0-9]{4}\M' AND body !~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'));
CREATE TABLE org_knowledge_version (
  knowledge_id uuid NOT NULL, org_id uuid NOT NULL, version integer NOT NULL,
  category text NOT NULL, title text NOT NULL, body text NOT NULL, source text, as_of date, status text NOT NULL,
  approved_by uuid, edited_by uuid, recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (knowledge_id, version), FOREIGN KEY (knowledge_id, org_id) REFERENCES org_knowledge (id, org_id));
-- Server stamps: id/org/creator are fixed after insert, version +1 on any change, approved_by is the caller who approves.
CREATE FUNCTION org_knowledge_stamp() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.version := 1; NEW.created_at := now(); NEW.updated_at := now(); NEW.created_by := coalesce(auth.uid(), NEW.created_by);
    NEW.approved_by := CASE WHEN NEW.status = 'approved' THEN coalesce(auth.uid(), NEW.approved_by) END; RETURN NEW;
  END IF;
  NEW.id := OLD.id; NEW.org_id := OLD.org_id; NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
  IF (NEW.category, NEW.title, NEW.body, NEW.source, NEW.as_of, NEW.status) IS NOT DISTINCT FROM (OLD.category, OLD.title, OLD.body, OLD.source, OLD.as_of, OLD.status) THEN
    NEW.version := OLD.version; NEW.updated_at := OLD.updated_at; NEW.approved_by := OLD.approved_by; RETURN NEW;
  END IF;
  NEW.version := OLD.version + 1; NEW.updated_at := now();
  NEW.approved_by := CASE WHEN NEW.status = 'approved' THEN coalesce(auth.uid(), NEW.approved_by) ELSE OLD.approved_by END;
  RETURN NEW;
END; $$;
CREATE TRIGGER org_knowledge_stamp BEFORE INSERT OR UPDATE ON org_knowledge FOR EACH ROW EXECUTE FUNCTION org_knowledge_stamp();
-- SECURITY DEFINER because no app role may write org_knowledge_version; only this trigger does, from the row just written.
CREATE FUNCTION org_knowledge_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO org_knowledge_version (knowledge_id, org_id, version, category, title, body, source, as_of, status, approved_by, edited_by)
    VALUES (NEW.id, NEW.org_id, NEW.version, NEW.category, NEW.title, NEW.body, NEW.source, NEW.as_of, NEW.status, NEW.approved_by, auth.uid())
    ON CONFLICT (knowledge_id, version) DO NOTHING;
  RETURN NULL;
END; $$;
CREATE TRIGGER org_knowledge_snapshot AFTER INSERT OR UPDATE ON org_knowledge FOR EACH ROW EXECUTE FUNCTION org_knowledge_snapshot();
REVOKE ALL ON FUNCTION org_knowledge_stamp(), org_knowledge_snapshot() FROM PUBLIC, anon, authenticated;
-- Deny by default. Admin: read/insert/update in own org. Staff: approved rows in own org. Board, anon, no-role: nothing. Nobody deletes.
ALTER TABLE org_knowledge ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY org_knowledge_sel ON org_knowledge FOR SELECT TO authenticated
  USING (org_id = app_org_id() AND (app_role() = 'admin' OR (app_role() = 'staff' AND status = 'approved')));
CREATE POLICY org_knowledge_ins ON org_knowledge FOR INSERT TO authenticated WITH CHECK (org_id = app_org_id() AND app_role() = 'admin');
CREATE POLICY org_knowledge_upd ON org_knowledge FOR UPDATE TO authenticated
  USING (org_id = app_org_id() AND app_role() = 'admin') WITH CHECK (org_id = app_org_id() AND app_role() = 'admin');
ALTER TABLE org_knowledge_version ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY org_knowledge_version_sel ON org_knowledge_version FOR SELECT TO authenticated
  USING (org_id = app_org_id() AND (app_role() = 'admin' OR (app_role() = 'staff' AND status = 'approved')));
REVOKE DELETE ON org_knowledge FROM anon, authenticated; REVOKE INSERT, UPDATE, DELETE ON org_knowledge_version FROM anon, authenticated;
