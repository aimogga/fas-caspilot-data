-- F-508h (#243 QA): an approved application is read-only; a change starts a new version. Once approved, status only moves to archived
-- (never back to DRAFT, not even through archived), and a content edit to a non-DRAFT row is refused instead of silently dropped. Forward-only.
CREATE OR REPLACE FUNCTION application_draft_review() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  NEW.org_id := OLD.org_id; NEW.opportunity_id := OLD.opportunity_id; NEW.strategy_draft_id := OLD.strategy_draft_id;
  NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at; NEW.updated_at := now();
  IF OLD.status <> 'DRAFT' AND (NEW.sections, NEW.validation_report, NEW.model_meta) IS DISTINCT FROM (OLD.sections, OLD.validation_report, OLD.model_meta) THEN
    RAISE EXCEPTION 'an approved or archived application draft is read-only; start a new version' USING ERRCODE = '42501'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND app_role() <> 'admin' THEN RAISE EXCEPTION 'only admin changes an application draft status' USING ERRCODE = '42501'; END IF;
  IF OLD.approved_at IS NOT NULL AND NEW.status NOT IN (OLD.status, 'archived') THEN
    RAISE EXCEPTION 'an approved application draft only moves to archived; start a new version' USING ERRCODE = '42501'; END IF;
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    IF OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'only a DRAFT application can be approved' USING ERRCODE = '22023'; END IF;
    NEW.approved_by := auth.uid(); NEW.approved_at := now();
  ELSE NEW.approved_by := OLD.approved_by; NEW.approved_at := OLD.approved_at; END IF;
  RETURN NEW;
END; $$;
