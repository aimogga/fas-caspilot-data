-- F-301 part 3: commit an upload as a versioned batch; roll a batch back.
-- Provenance (ARCHITECTURE rule 3): every FAS row carries upload_batch_id, so the four child tables get the same composite FK `case` has.
ALTER TABLE upload_batch ADD COLUMN entity text, ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['application','authorization','delivery_episode','outcome_measure'] LOOP
  EXECUTE format('ALTER TABLE %I ADD COLUMN upload_batch_id uuid, ADD FOREIGN KEY (upload_batch_id, org_id) REFERENCES upload_batch (id, org_id)', t);
END LOOP; END $$;
CREATE FUNCTION intake_table(entity text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT CASE entity WHEN 'case' THEN 'case' WHEN 'application' THEN 'application'
  WHEN 'authorization' THEN 'authorization' WHEN 'delivery' THEN 'delivery_episode' WHEN 'outcome' THEN 'outcome_measure' END; $$;
-- SECURITY INVOKER: F-102 INSERT policies apply to every row; org_id and upload_batch_id are stamped here and override anything the client sent.
CREATE FUNCTION intake_commit(entity text, mapping jsonb, rows jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE tbl text := intake_table(entity); n integer := jsonb_array_length(rows); batch uuid;
BEGIN
  IF tbl IS NULL THEN RAISE EXCEPTION 'intake_commit: unknown entity %', entity USING ERRCODE = '22023'; END IF;
  INSERT INTO upload_batch (org_id, entity, mapping, rows_ok, rows_error, status, created_by)
    VALUES (app_org_id(), entity, mapping, n, 0, 'committed', auth.uid()) RETURNING id INTO batch;
  EXECUTE format('INSERT INTO %I SELECT (jsonb_populate_record(NULL::%I, r || $1 || CASE WHEN r->>''id'' IS NULL THEN jsonb_build_object(''id'', gen_random_uuid()) ELSE ''{}'' END)).* FROM jsonb_array_elements($2) r', tbl, tbl)
    USING jsonb_build_object('org_id', app_org_id(), 'upload_batch_id', batch), rows;
  INSERT INTO audit_log (org_id, actor, action, entity, entity_id, details)
    VALUES (app_org_id(), auth.uid(), 'intake.commit', tbl, batch, jsonb_build_object('entity', entity, 'rows', n));
  RETURN batch;
END; $$;
-- SECURITY DEFINER because F-102 gives DELETE to admin only and rollback is the one sanctioned staff delete: role + org are checked here, and only rows stamped with this batch id in the caller's org are touched.
CREATE FUNCTION intake_rollback(batch_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b upload_batch%ROWTYPE; n integer;
BEGIN
  IF app_role() NOT IN ('admin', 'staff') OR app_org_id() IS NULL THEN RAISE EXCEPTION 'intake_rollback: forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO b FROM upload_batch WHERE id = batch_id AND org_id = app_org_id();
  IF NOT FOUND OR intake_table(b.entity) IS NULL THEN RAISE EXCEPTION 'intake_rollback: not_found' USING ERRCODE = 'P0002'; END IF;
  IF b.status <> 'committed' THEN RAISE EXCEPTION 'intake_rollback: already rolled back' USING ERRCODE = '55000'; END IF;
  EXECUTE format('DELETE FROM %I WHERE upload_batch_id = $1 AND org_id = $2', intake_table(b.entity)) USING b.id, b.org_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE upload_batch SET status = 'rolled_back' WHERE id = b.id AND org_id = b.org_id;
  INSERT INTO audit_log (org_id, actor, action, entity, entity_id, details)
    VALUES (b.org_id, auth.uid(), 'intake.rollback', intake_table(b.entity), b.id, jsonb_build_object('entity', b.entity, 'rows', n));
  RETURN n;
END; $$;
REVOKE ALL ON FUNCTION intake_table(text), intake_commit(text, jsonb, jsonb), intake_rollback(uuid) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION intake_table(text), intake_commit(text, jsonb, jsonb), intake_rollback(uuid) TO authenticated;
