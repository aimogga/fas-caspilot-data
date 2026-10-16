-- F-508g: application_draft (cited sections from an approved strategy) and its append-only edit history. Forward-only.
-- Staff and admin in the org read, insert (DRAFT, from an approved strategy) and edit DRAFT rows; only admin changes status. Board, other orgs, anon: nothing.
CREATE TABLE application_draft (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES org(id),
  opportunity_id uuid NOT NULL REFERENCES opportunity(id), strategy_draft_id uuid NOT NULL REFERENCES strategy_draft(id),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'approved', 'archived')),
  sections jsonb NOT NULL DEFAULT '[]'::jsonb, validation_report jsonb, model_meta jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid(), approved_by uuid, approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (id, org_id));
ALTER TABLE application_draft ENABLE ROW LEVEL SECURITY;

CREATE POLICY application_draft_sel ON application_draft FOR SELECT TO authenticated
  USING (org_id = app_org_id() AND app_role() IN ('admin', 'staff'));
CREATE POLICY application_draft_ins ON application_draft FOR INSERT TO authenticated
  WITH CHECK (org_id = app_org_id() AND app_role() IN ('admin', 'staff') AND created_by = auth.uid()
    AND status = 'DRAFT' AND approved_by IS NULL AND approved_at IS NULL
    AND EXISTS (SELECT 1 FROM strategy_draft s WHERE s.id = strategy_draft_id AND s.org_id = application_draft.org_id
      AND s.opportunity_id = application_draft.opportunity_id AND s.status = 'approved'));
CREATE POLICY application_draft_upd ON application_draft FOR UPDATE TO authenticated
  USING (org_id = app_org_id() AND (app_role() = 'admin' OR (app_role() = 'staff' AND status = 'DRAFT')))
  WITH CHECK (org_id = app_org_id() AND app_role() IN ('admin', 'staff'));

-- Provenance never changes; only a DRAFT's content changes; only admin changes status; approval stamps who and when.
CREATE OR REPLACE FUNCTION application_draft_review() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  NEW.org_id := OLD.org_id; NEW.opportunity_id := OLD.opportunity_id; NEW.strategy_draft_id := OLD.strategy_draft_id;
  NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at; NEW.updated_at := now();
  IF OLD.status <> 'DRAFT' THEN NEW.sections := OLD.sections; NEW.validation_report := OLD.validation_report; NEW.model_meta := OLD.model_meta; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND app_role() <> 'admin' THEN
    RAISE EXCEPTION 'only admin changes an application draft status' USING ERRCODE = '42501';
  END IF;
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    IF OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'only a DRAFT application can be approved' USING ERRCODE = '22023'; END IF;
    NEW.approved_by := auth.uid(); NEW.approved_at := now();
  ELSE
    NEW.approved_by := OLD.approved_by; NEW.approved_at := OLD.approved_at;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER application_draft_review BEFORE UPDATE ON application_draft FOR EACH ROW EXECUTE FUNCTION application_draft_review();

CREATE TABLE application_draft_edit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL,
  application_draft_id uuid NOT NULL, section_key text NOT NULL, before text, after text,
  editor uuid NOT NULL DEFAULT auth.uid(), at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (application_draft_id, org_id) REFERENCES application_draft(id, org_id));
ALTER TABLE application_draft_edit ENABLE ROW LEVEL SECURITY;

CREATE POLICY application_draft_edit_sel ON application_draft_edit FOR SELECT TO authenticated
  USING (org_id = app_org_id() AND app_role() IN ('admin', 'staff'));
CREATE POLICY application_draft_edit_ins ON application_draft_edit FOR INSERT TO authenticated
  WITH CHECK (org_id = app_org_id() AND app_role() IN ('admin', 'staff') AND editor = auth.uid()
    AND EXISTS (SELECT 1 FROM application_draft d WHERE d.id = application_draft_id AND d.org_id = application_draft_edit.org_id AND d.status = 'DRAFT'));

-- Append-only for everyone, the service role included: no update or delete policy, and this trigger refuses both.
CREATE OR REPLACE FUNCTION application_draft_edit_append_only() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'application_draft_edit is append-only' USING ERRCODE = '42501';
END; $$;
CREATE TRIGGER application_draft_edit_append_only BEFORE UPDATE OR DELETE ON application_draft_edit
  FOR EACH ROW EXECUTE FUNCTION application_draft_edit_append_only();
