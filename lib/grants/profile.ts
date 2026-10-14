// F-503: FAS org profile for eligibility checks. Reads the `org` row (F-102 part 1) and fills gaps with 'unknown'.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrgProfile, SamStatus } from './types';

// synthetic placeholder values for tests and previews; real FAS profile is George-gated
export const FAS_PROFILE_SYNTHETIC: OrgProfile = {
  name: 'Family Advocacy Services (synthetic)',
  is_501c3: true,
  state: 'UT',
  sam_status: 'active',
  service_counties: ['49035', '49049', '49011', '49057'],
  annual_budget_usd: 600_000,
  populations_served: ['court-involved families', 'low-income families', 'children'],
  program_themes: ['therapy', 'mental health', 'family preservation', 'court-involved families', 'social services'],
  has_audited_financials: true,
  years_operating: 12,
};

type OrgRow = { name: string; ein: string | null; uei: string | null; state: string | null; settings: Record<string, unknown> | null };
const SAM: SamStatus[] = ['active', 'expired', 'unknown'];
const str = (v: unknown) => (typeof v === 'string' && v ? v : 'unknown') as string | 'unknown';
const bool = (v: unknown) => (typeof v === 'boolean' ? v : 'unknown') as boolean | 'unknown';
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 'unknown') as number | 'unknown';
const list = (v: unknown) => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : 'unknown') as string[] | 'unknown';

/** Map an `org` row: name/state are columns (uei alone says nothing about SAM status); the rest is `settings` jsonb or 'unknown'. */
export function profileFromOrgRow(row: OrgRow): OrgProfile {
  const s = row.settings ?? {};
  const sam: SamStatus = SAM.includes(s.sam_status as SamStatus) ? (s.sam_status as SamStatus) : 'unknown';
  return { name: row.name, is_501c3: bool(s.is_501c3), state: str(row.state), sam_status: sam, service_counties: list(s.service_counties),
    annual_budget_usd: num(s.annual_budget_usd), populations_served: list(s.populations_served), program_themes: list(s.program_themes),
    has_audited_financials: bool(s.has_audited_financials), years_operating: num(s.years_operating) };
}

/** Load the org profile; null when the row is missing or RLS hides it. */
export async function loadOrgProfile(client: SupabaseClient, orgId: string): Promise<OrgProfile | null> {
  const { data, error } = await client.from('org').select('name,ein,uei,state,settings').eq('id', orgId).maybeSingle();
  if (error || !data) return null;
  return profileFromOrgRow(data as OrgRow);
}
