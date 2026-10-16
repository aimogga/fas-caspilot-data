-- F-508g: FORCE RLS on both tables, as strategy_draft, award_abstract and recipient_profile do. Forward-only (030000 is applied).
ALTER TABLE application_draft FORCE ROW LEVEL SECURITY; ALTER TABLE application_draft_edit FORCE ROW LEVEL SECURITY;
