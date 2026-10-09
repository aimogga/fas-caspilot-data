/** Pure F-103 synthetic generator. Default seed is fixed; same seed → identical rows. */
export const SYNTH_ORG = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const DEFAULT_SEED = 103;
export const DEFAULT_CASES = 200;
export const WINDOW_START = '2024-01-01', WINDOW_END = '2025-03-31';
export const SMALL_FIPS = ['49009', '49031', '49033', '49055', '49017'] as const;
const REASONS = ['no_show', 'moved', 'declined', 'waitlist'] as const;
export const MEASURES = [{ code: 'PHQ-9', max: 27 }, { code: 'GAD-7', max: 21 }, { code: 'OQ-45', max: 180 }, { code: 'YOQ', max: 240 }] as const;
const CASE_FIPS = ['49035', '49049', '49011', '49057', '49053', '49005', '49009', '49031', '49033', '49055', '49017', '49045'];
const WEIGHTS = [48, 28, 14, 10, 8, 5, 1, 1, 1, 1, 1, 3];
const WSUM = WEIGHTS.reduce((a, b) => a + b, 0);

export type County = { fips: string; name: string; state: 'UT'; population_latest: null };
export const COUNTIES: County[] = '01 Beaver|03 Box Elder|05 Cache|07 Carbon|09 Daggett|11 Davis|13 Duchesne|15 Emery|17 Garfield|19 Grand|21 Iron|23 Juab|25 Kane|27 Millard|29 Morgan|31 Piute|33 Rich|35 Salt Lake|37 San Juan|39 Sanpete|41 Sevier|43 Summit|45 Tooele|47 Uintah|49 Utah|51 Wasatch|53 Washington|55 Wayne|57 Weber'
  .split('|')
  .map((s) => ({ fips: `49${s.slice(0, 2).padStart(3, '0')}`, name: s.slice(3), state: 'UT', population_latest: null }));

export type Rec = Record<string, unknown>;
export type Bundle = {
  geo_county: County[];
  org: Rec[];
  provider: Rec[];
  upload_batch: Rec[];
  case: Rec[];
  application: Rec[];
  authorization: Rec[];
  delivery_episode: Rec[];
  outcome_measure: Rec[];
};

function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function uid(n: number): string {
  return `f1030000-0000-4000-a000-${n.toString(16).padStart(12, '0')}`;
}

function ymd(offset: number): string {
  return new Date(Date.UTC(2024, 0, 1 + offset)).toISOString().slice(0, 10);
}

function countyAt(i: number, r: () => number): string {
  if (i < 12) return CASE_FIPS[i]!;
  let x = r() * WSUM, k = 0; for (; k < 12 && (x -= WEIGHTS[k]!) >= 0; k++);
  return CASE_FIPS[Math.min(k, 11)]!;
}

export function generate(seed = DEFAULT_SEED, nCases = DEFAULT_CASES): Bundle {
  const r = rng(seed);
  const provider = Array.from({ length: 12 }, (_, i) => ({
    id: uid(1 + i), org_id: SYNTH_ORG, name: `Provider ${String(i + 1).padStart(3, '0')}`,
    npi: `SYN${String(i + 1).padStart(8, '0')}`, provider_affiliated: i % 2 === 0,
  }));
  const upload_batch = [{ id: uid(100), org_id: SYNTH_ORG, file_path: '/synthetic/f103.csv', mapping: {}, rows_ok: nCases, rows_error: 0, status: 'ok' }];
  const cases: Rec[] = [];
  const application: Rec[] = [];
  const authorization: Rec[] = [];
  const delivery_episode: Rec[] = [];
  const outcome_measure: Rec[] = [];
  for (let i = 0; i < nCases; i++) {
    const court = i % 5 < 2;
    const refOff = 30 + Math.floor(r() * 250);
    const lag = 1 + (i % 30);
    const cid = uid(1000 + i);
    cases.push({
      id: cid, org_id: SYNTH_ORG, referral_source: court ? 'court' : i % 2 ? 'self' : 'school',
      court_involved: court, court_order_date: court ? ymd(refOff - lag) : null, referral_date: ymd(refOff),
      county_fips: countyAt(i, r), household_size: 1 + (i % 6),
      income_band: ['a', 'b', 'c', 'd'][i % 4], prior_services: [], upload_batch_id: uid(100),
    });
    const approved = i % 7 !== 0;
    const units = 4 + (i % 8);
    const rate = 80 + (i % 10) * 5;
    const authTot = units * rate;
    application.push({
      id: uid(2000 + i), org_id: SYNTH_ORG, case_id: cid, application_date: ymd(refOff + 16),
      decision_date: ymd(refOff + 23), decision: approved ? 'approved' : 'denied',
      award_amount: approved ? authTot + (i % 5) * 10 : 0, family_contribution: approved ? (i % 5) * 10 : 0,
    });
    if (!approved) continue;
    const zid = uid(3000 + i);
    const kind = i % 5;
    const sessions = kind === 0 ? 0 : kind === 1 ? Math.min(units, 1 + (i % 3)) : 1 + (i % units);
    const firstOff = kind === 0 ? null : refOff + 30;
    const lastOff = firstOff == null ? null : firstOff + (kind === 1 ? 7 : 45);
    const baseOff = firstOff ?? refOff + 23;
    const hasFu = i % 5 !== 0;
    const fuOff = hasFu ? Math.max(baseOff, lastOff ?? baseOff) + 14 : null;
    authorization.push({
      id: zid, org_id: SYNTH_ORG, application_id: uid(2000 + i), service_type: 'therapy',
      provider_id: provider[i % 12]!.id, units, rate, total_authorized: authTot,
    });
    delivery_episode.push({
      id: uid(4000 + i), org_id: SYNTH_ORG, authorization_id: zid,
      first_session_date: firstOff == null ? null : ymd(firstOff),
      last_session_date: lastOff == null ? null : ymd(lastOff),
      sessions_attended: sessions, no_shows: kind === 0 ? 0 : i % 3,
      discharge_status: kind === 0 ? null : kind === 1 ? 'dropped' : 'completed',
      non_start_reason: kind === 0 ? REASONS[Math.floor(i / 5) % REASONS.length] : null,
      dollars_paid: sessions * rate,
    });
    const m = MEASURES[i % 4];
    const baseline = Math.min(m.max - 2, Math.max(2, Math.floor(r() * (m.max - 4)) + 2));
    const mix = i % 3;
    const follow = !hasFu ? null : mix === 0 ? Math.max(0, baseline - 1 - (i % 4))
      : mix === 1 ? baseline : Math.min(m.max, baseline + 1 + (i % 3));
    outcome_measure.push({
      id: uid(5000 + i), org_id: SYNTH_ORG, case_id: cid, measure_code: m.code,
      baseline_score: baseline, baseline_date: ymd(baseOff),
      followup_score: follow, followup_date: fuOff == null ? null : ymd(fuOff),
    });
  }
  return {
    geo_county: COUNTIES,
    org: [{ id: SYNTH_ORG, name: 'FAS Synthetic', ein: '00-0000001', uei: 'UEIFAS0001', state: 'UT', settings: {} }],
    provider, upload_batch, case: cases, application, authorization, delivery_episode, outcome_measure,
  };
}

export type Summary = {
  court: number; nonCourt: number; nonStarts: Record<string, number>;
  completed: number; dropped: number; affiliatedShare: number; meanChange: Record<string, number | null>;
};

function avg(xs: number[]): number | null {
  if (!xs.length) return null;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 1e4) / 1e4;
}

export function summarize(b: Bundle): Summary {
  const court = b.case.filter((c) => c.court_involved).length;
  const nonStarts: Record<string, number> = {};
  for (const e of b.delivery_episode) {
    const k = e.non_start_reason as string | null;
    if (k) nonStarts[k] = (nonStarts[k] ?? 0) + 1;
  }
  const affN = b.authorization.filter((a) => b.provider.find((p) => p.id === a.provider_id)?.provider_affiliated).length;
  const meanChange: Record<string, number | null> = {};
  for (const { code } of MEASURES) {
    meanChange[code] = avg(
      b.outcome_measure.filter((o) => o.measure_code === code && o.followup_score != null)
        .map((o) => Number(o.followup_score) - Number(o.baseline_score)),
    );
  }
  return {
    court, nonCourt: b.case.length - court, nonStarts,
    completed: b.delivery_episode.filter((e) => e.discharge_status === 'completed').length,
    dropped: b.delivery_episode.filter((e) => e.discharge_status === 'dropped').length,
    affiliatedShare: b.authorization.length ? Math.round((affN / b.authorization.length) * 1e4) / 1e4 : 0,
    meanChange,
  };
}

const COLS: Record<keyof Bundle, string[]> = {
  geo_county: ['fips', 'name', 'state', 'population_latest'],
  org: ['id', 'name', 'ein', 'uei', 'state', 'settings'],
  upload_batch: ['id', 'org_id', 'file_path', 'mapping', 'rows_ok', 'rows_error', 'status'],
  provider: ['id', 'org_id', 'name', 'npi', 'provider_affiliated'],
  case: ['id', 'org_id', 'referral_source', 'court_involved', 'court_order_date', 'referral_date', 'county_fips', 'household_size', 'income_band', 'prior_services', 'upload_batch_id'],
  application: ['id', 'org_id', 'case_id', 'application_date', 'decision_date', 'decision', 'award_amount', 'family_contribution'],
  authorization: ['id', 'org_id', 'application_id', 'service_type', 'provider_id', 'units', 'rate', 'total_authorized'],
  delivery_episode: ['id', 'org_id', 'authorization_id', 'first_session_date', 'last_session_date', 'sessions_attended', 'no_shows', 'discharge_status', 'non_start_reason', 'dollars_paid'],
  outcome_measure: ['id', 'org_id', 'case_id', 'measure_code', 'baseline_score', 'baseline_date', 'followup_score', 'followup_date'],
};

function lit(v: unknown): string {
  if (v == null) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

function qtbl(t: string): string {
  return t === 'case' || t === 'authorization' ? `"${t}"` : t;
}

/** Deletes only F-103 ids (prefix f103) for the synthetic org, then INSERTs. Safe as postgres. */
export function toSql(b: Bundle): string {
  const del = (['outcome_measure', 'delivery_episode', 'authorization', 'application', 'case', 'provider', 'upload_batch'] as const)
    .map((t) => `DELETE FROM ${qtbl(t)} WHERE org_id = '${SYNTH_ORG}' AND id::text LIKE 'f103%';`).join('\n');
  const ins = (Object.keys(COLS) as (keyof Bundle)[]).map((t) => {
    const cols = COLS[t];
    const vals = (b[t] as Rec[]).map((row) => `(${cols.map((c) => lit(row[c])).join(',')})`).join(',\n');
    const on = t === 'geo_county' ? ' ON CONFLICT (fips) DO UPDATE SET name = EXCLUDED.name, state = EXCLUDED.state'
      : t === 'org' ? ' ON CONFLICT (id) DO NOTHING' : '';
    return `INSERT INTO ${qtbl(t)} (${cols.join(',')}) VALUES\n${vals}${on};`;
  }).join('\n');
  return `-- F-103 synthetic seed (do not commit)\nBEGIN;\n${del}\n${ins}\nCOMMIT;\n`;
}
