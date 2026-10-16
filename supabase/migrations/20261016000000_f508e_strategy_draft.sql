-- F-508e: strategy_draft for the cited draft engine (docs/GRANT_MATCHING.md "Strategy draft"). Forward-only.
-- Packet names for the columns, a `failed` status, adapter meta and approval stamps. Staff and admin read and insert
-- (DRAFT or failed only); only admin updates, and approving stamps approved_by/approved_at. Board and other orgs: nothing.
ALTER TABLE strategy_draft RENAME COLUMN inputs_snapshot TO snapshot;
ALTER TABLE strategy_draft RENAME COLUMN citations TO citation_report;
ALTER TABLE strategy_draft ADD COLUMN model_meta jsonb, ADD COLUMN approved_at timestamptz,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(), ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE strategy_draft DROP CONSTRAINT strategy_draft_status_check;
UPDATE strategy_draft SET status = 'DRAFT' WHERE status = 'draft';
ALTER TABLE strategy_draft ADD CONSTRAINT strategy_draft_status_check CHECK (status IN ('DRAFT', 'approved', 'rejected', 'failed'));

DROP POLICY strategy_draft_ins ON strategy_draft;
CREATE POLICY strategy_draft_ins ON strategy_draft FOR INSERT TO authenticated
  WITH CHECK (org_id = app_org_id() AND app_role() IN ('admin', 'staff') AND created_by = auth.uid()
    AND status IN ('DRAFT', 'failed') AND approved_by IS NULL AND approved_at IS NULL);
DROP POLICY strategy_draft_upd ON strategy_draft;
CREATE POLICY strategy_draft_upd ON strategy_draft FOR UPDATE TO authenticated
  USING (org_id = app_org_id() AND app_role() = 'admin') WITH CHECK (org_id = app_org_id() AND app_role() = 'admin');

-- An update is a review: only status changes. Only a DRAFT can be approved (a failed draft is never usable).
CREATE OR REPLACE FUNCTION strategy_draft_review() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    IF OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'only a DRAFT strategy draft can be approved' USING ERRCODE = '22023'; END IF;
    NEW.approved_by := auth.uid(); NEW.approved_at := now();
  ELSIF NEW.status <> 'approved' THEN
    NEW.approved_by := NULL; NEW.approved_at := NULL;
  ELSE
    NEW.approved_by := OLD.approved_by; NEW.approved_at := OLD.approved_at;
  END IF;
  NEW.snapshot := OLD.snapshot; NEW.output := OLD.output; NEW.citation_report := OLD.citation_report; NEW.model_meta := OLD.model_meta;
  NEW.org_id := OLD.org_id; NEW.opportunity_id := OLD.opportunity_id; NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
  RETURN NEW;
END; $$;
CREATE TRIGGER strategy_draft_review BEFORE UPDATE ON strategy_draft FOR EACH ROW EXECUTE FUNCTION strategy_draft_review();
