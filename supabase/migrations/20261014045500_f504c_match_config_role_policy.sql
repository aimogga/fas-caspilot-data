-- F-504c: match_config SELECT reads like the other public config tables (need_score_config, f102_part1):
-- signed-in users without an app role see nothing. Forward-only; the F-504 migration is left as applied.
DROP POLICY IF EXISTS match_config_sel ON match_config;
CREATE POLICY match_config_sel ON match_config FOR SELECT TO authenticated USING (app_role() IN ('admin', 'staff', 'board_viewer'));
