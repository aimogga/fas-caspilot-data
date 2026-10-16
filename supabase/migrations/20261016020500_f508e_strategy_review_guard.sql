-- F-508e: close two gaps in strategy_draft_review (20261016020000), found in review of #241. Forward-only.
-- failed is final and nothing returns to DRAFT, so failed -> DRAFT -> approved is refused (a failed draft is never usable);
-- an update also keeps the row id.
CREATE OR REPLACE FUNCTION strategy_draft_review() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.status = 'failed' AND NEW.status <> 'failed' THEN RAISE EXCEPTION 'a failed strategy draft stays failed' USING ERRCODE = '22023'; END IF;
  IF NEW.status = 'DRAFT' AND OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'a strategy draft cannot return to DRAFT' USING ERRCODE = '22023'; END IF;
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    IF OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'only a DRAFT strategy draft can be approved' USING ERRCODE = '22023'; END IF;
    NEW.approved_by := auth.uid(); NEW.approved_at := now();
  ELSIF NEW.status <> 'approved' THEN
    NEW.approved_by := NULL; NEW.approved_at := NULL;
  ELSE
    NEW.approved_by := OLD.approved_by; NEW.approved_at := OLD.approved_at;
  END IF;
  NEW.snapshot := OLD.snapshot; NEW.output := OLD.output; NEW.citation_report := OLD.citation_report; NEW.model_meta := OLD.model_meta;
  NEW.id := OLD.id; NEW.org_id := OLD.org_id; NEW.opportunity_id := OLD.opportunity_id; NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
  RETURN NEW;
END; $$;
