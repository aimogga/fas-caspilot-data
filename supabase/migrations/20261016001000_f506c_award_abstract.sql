-- F-506c: published award abstracts for past winners (analysis only; never copied into FAS drafts). Public data; service role writes, admin/staff read.
INSERT INTO source_registry (id, name, owner, url, license, commercial_ok, cadence, status)
VALUES ('f5060000-0000-4000-8000-00000000c50c', 'ojp_awards', 'DOJ Office of Justice Programs', 'https://www.ojp.gov/funding/explore/ojp-award-data',
  'U.S. government work, public domain; robots.txt respected, 1 request/second', true, 'on request', 'active')
ON CONFLICT (id) DO NOTHING;
-- AC2: the award detail endpoint's period of performance lands on the award itself.
ALTER TABLE award_history ADD COLUMN IF NOT EXISTS period_start date, ADD COLUMN IF NOT EXISTS period_end date;
CREATE TABLE award_abstract (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  award_history_id uuid NOT NULL REFERENCES award_history(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('usaspending_detail','ojp_award_page','other')),
  "text" text, word_count integer CHECK (word_count >= 0), source_url text,
  fetched_at timestamptz NOT NULL DEFAULT now(), ingest_run_id uuid REFERENCES ingest_run(id),
  status text NOT NULL CHECK (status IN ('published','not_published','fetch_failed')),
  reason text,
  UNIQUE (award_history_id, source),
  -- AC4: a published row has its text; every other row says why, so nothing is silently blank.
  CONSTRAINT award_abstract_text_or_reason CHECK (CASE WHEN status = 'published' THEN "text" IS NOT NULL AND word_count IS NOT NULL ELSE reason IS NOT NULL END));
ALTER TABLE award_abstract ENABLE ROW LEVEL SECURITY;
ALTER TABLE award_abstract FORCE ROW LEVEL SECURITY;
CREATE POLICY award_abstract_sel ON award_abstract FOR SELECT TO authenticated USING (app_role() IN ('admin','staff'));
REVOKE ALL ON award_abstract FROM anon;
