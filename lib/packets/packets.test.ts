import { describe, expect, it } from 'vitest';
import { generate } from '@/lib/synthetic/generate';
import { MetricsQuery, type M2Row, type O1Row } from '@/lib/dashboard/metrics-query';
import { MethodologyQuery } from '@/lib/methodology/query';
import { NeedMapQuery } from '@/lib/need-map/query';
import { assertPacket, CASE_FIELDS, EXACT_DATE, renderText } from './assert';
import { BOM, CSV_HEADER, csvCell, csvRows, packetToCsv } from './csv';
import { docxText, packetToDocx } from './docx';
import { exportFilename, renderExport } from './export';
import { buildPacket, PICTURE_SECTION, scopeLabel, type Packet, type PacketInput } from './model';
import { PacketQuery, parsePacketParams } from './query';
type Rec = Record<string, unknown>;
const s = (v: unknown) => (v == null ? null : String(v)), NOW = new Date('2024-11-01T00:00:00Z');
const b = generate(20, 20);
const m2: M2Row[] = b.application.map((a: Rec) => ({ application_id: String(a.id), case_id: String(a.case_id), application_date: s(a.application_date), decision_date: s(a.decision_date) }));
const o1: O1Row[] = b.outcome_measure.map((o: Rec) => ({ measure_code: String(o.measure_code), baseline_score: o.baseline_score as number | null, followup_score: o.followup_score as number | null, followup_date: s(o.followup_date) }));
const metrics = MetricsQuery.build({ m1: null, m2, m3: null, eps: null, o1 }, { period: '2024-Q3', county: 'all', referral: 'all', compare: 'prior' });
const pub = {
  configs: [{ version: 'v2-synthetic', weights: { uninsured: 1 }, created_at: '2026-10-01T00:00:00Z', approved_by: 'u1' }], sources: [{ id: 's1', name: 'census-sahie', last_success_at: '2026-10-03T12:00:00Z' }],
  scores: [{ version: 'v2-synthetic', geo_fips: '49035', score: 1.5 }, { version: 'v2-synthetic', geo_fips: '49049', score: 0.5 }, { version: 'v2-synthetic', geo_fips: '49011', score: -0.5 }],
  indicators: [{ source_id: 's1', indicator_code: 'uninsured_rate', geo_fips: '49035', value: 9.1, moe: 0.4, unit: 'percent', vintage: '2023' }],
  fas: [],
};
const input = (over: Partial<PacketInput> = {}): PacketInput => ({ variant: 'grant', scope: { county: '49035' }, now: NOW, period: '2024-Q3', asOf: 'Dec 2024', metrics, need: NeedMapQuery.build(pub), method: MethodologyQuery.build(pub), serviceCounties: ['Davis', 'Salt Lake'], ...over });
const ORDER = ['County need profile', 'FAS results', 'Outcomes', 'Methodology and sources', 'Suppression note', 'Related-party disclosure'];
describe('buildPacket (F-403)', () => {
  it('grant packet for a county: six sections in order, county profile with ranked score and sourced indicators, hidden metrics read fewer than 11, zero violations', () => {
    const p = buildPacket(input()), text = renderText(p).join('\n');
    expect(p.sections.map((x) => x.title)).toEqual(ORDER);
    expect([p.title, p.prepared, p.asOf, p.ribbon, p.footer]).toEqual(['FAS Evidence packet · Grant attachment · Salt Lake County', 'Prepared Nov 2024', 'Data as of Dec 2024', 'DRAFT · for review', 'FAS Evidence · Counts under 11 are hidden · Nov 2024']);
    expect(p.sections[0]?.paragraphs[0]).toMatch(/^Salt Lake County ranks 1 of 3 Utah counties on the FAS need score \(version v2-synthetic, score \+1\.50\)/);
    expect(p.sections[0]?.figures).toEqual([{ label: 'Uninsured rate', value: '9.1% ± 0.4', kind: 'value', sourceLabel: 'Census SAHIE 2023', asOf: 'Oct 2026' }]);
    expect(p.sections[1]?.figures.find((f) => f.label.startsWith('Days from application'))).toMatchObject({ value: 'fewer than 11', asOf: 'Oct 2024', sourceLabel: 'FAS records · Jul–Sep 2024 (Q3)' });
    expect(text).toMatch(/Fewer than 11 applications were decided/);
    expect(p.sections[3]?.figures[0]).toEqual({ label: 'Uninsured rate', value: 'weight 1 (100%)', kind: 'value', sourceLabel: 'Census SAHIE 2023', asOf: 'Oct 2026' });
    expect(p.sections[5]?.paragraphs[0]).toMatch(/Connections Counseling Services/);
    expect(assertPacket(p)).toEqual([]);
  });
  it('board packet is statewide whatever county is passed, lists service counties and the top-ranked counties, and has zero violations; a statewide grant omits the service list', () => {
    const p = buildPacket(input({ variant: 'board' }));
    expect([p.title, scopeLabel('board', { county: '49035' }), scopeLabel('grant', { county: 'nope' })]).toEqual(['FAS Evidence packet · Board packet · Statewide', 'Statewide', 'Statewide']);
    expect(p.sections[0]?.paragraphs).toEqual(['Highest-need Utah counties on the FAS need score (version v2-synthetic): Salt Lake County (rank 1 of 3), Utah County (rank 2 of 3), Davis County (rank 3 of 3).', 'FAS service counties: Davis, Salt Lake.']);
    expect(assertPacket(p)).toEqual([]);
    const g = buildPacket(input({ scope: {}, need: null, method: null, metrics: null }));
    expect(g.sections[0]?.paragraphs).toEqual(['The county need score is not available yet.']);
    expect([g.sections[1]?.paragraphs, g.sections[3]?.paragraphs[0], assertPacket(g)]).toEqual([['This quarter’s numbers are not available yet.'], 'Need score methodology is not available yet.', []]);
  });
  it('carries the board pictures with a section for each, the quarter, and none without metrics', () => {
    const p = buildPacket(input());
    expect(p.period).toBe('2024-Q3');
    expect(p.pictures.length).toBeGreaterThan(0);
    for (const pic of p.pictures) expect(['fas-results', 'outcomes']).toContain(PICTURE_SECTION[pic.id]);
    expect(buildPacket(input({ metrics: null })).pictures).toEqual([]);
  });
  it('assertPacket catches each injected violation on its own', () => {
    const inject = (f: (p: Packet) => void) => { const p = buildPacket(input()); f(p); return assertPacket(p).map((v) => `${v.rule}:${v.text}`); };
    const sec = (p: Packet) => p.sections[1] as NonNullable<Packet['sections'][1]>;
    expect(inject((p) => sec(p).paragraphs.push('Court order dated 2024-07-01.'))).toEqual(['exact-date:2024-07-01']);
    expect(inject((p) => sec(p).paragraphs.push('First session on Jul 1, 2024 and 7/1/2024 and 1 Jul 2024.'))).toEqual(['exact-date:Jul 1, 2024', 'exact-date:7/1/2024', 'exact-date:1 Jul 2024']);
    expect(inject((p) => sec(p).paragraphs.push('Shown for n = 4 cases (3 of 14).'))).toEqual(['small-cell:n = 4', 'small-cell:(3 of 14)']);
    expect(inject((p) => sec(p).figures.push({ label: 'Cases', value: '7', kind: 'count', sourceLabel: 'FAS records', asOf: 'Sep 2024' }))).toEqual(['small-cell:Cases: 7']);
    expect(inject((p) => sec(p).paragraphs.push('Exported case_id and zip_code and dob columns.'))).toEqual(['case-field:case_id', 'case-field:zip_code', 'case-field:dob']);
    expect(inject((p) => sec(p).figures.push({ label: 'Wait', value: '12 days', kind: 'value', sourceLabel: '', asOf: 'Sep 2024' }))).toEqual(['unsourced:Wait: 12 days (no source · Sep 2024)']);
    expect(inject((p) => sec(p).figures.push({ label: 'Wait', value: '12 days', kind: 'value', sourceLabel: 'FAS records', asOf: '2024-09-30' }))).toEqual(['exact-date:2024-09-30', 'unsourced:Wait: 12 days (FAS records · 2024-09-30)']);
    expect(inject((p) => { sec(p).source = ''; })).toEqual(['unsourced:numbers without a section source']);
    expect(inject((p) => sec(p).figures.push({ label: 'Cases', value: '12', kind: 'count', sourceLabel: 'FAS records', asOf: 'Sep 2024' }))).toEqual([]);
  });
});
describe('PacketQuery (F-403)', () => {
  it('parses params safely; load reads the metric views with the county filter, writes export_job + audit_log for a staff actor only, and survives a failed table', async () => {
    expect([parsePacketParams({ variant: 'board', county: '49035' }), parsePacketParams({ variant: 'x', county: '12345' }), parsePacketParams({})]).toEqual([{ variant: 'board', scope: { county: '49035' } }, { variant: 'grant', scope: {} }, { variant: 'grant', scope: {} }]);
    const calls: string[] = [], inserts: Rec[] = [];
    const chain = (table: string) => {
      const fail = table === 'need_score_config' || table === 'case';
      const c: Record<string, unknown> = { then: (res: (v: unknown) => void, rej?: (e: unknown) => void) => (table === 'case' && rej ? rej(new Error('boom')) : res(fail ? { data: null, error: { message: 'boom' } } : { data: table === 'export_job' ? { id: 'job-1' } : [], error: null })) };
      for (const k of ['select', 'gte', 'lte', 'order', 'limit', 'single']) c[k] = () => c;
      c.eq = (col: string, v: string) => { calls.push(`${table}.${col}=${v}`); return c; };
      c.insert = (row: Rec) => { inserts.push({ table, ...row }); return c; };
      return c;
    };
    const client = { from: (table: string) => { calls.push(table); return chain(table); } } as never;
    const p = await PacketQuery.load(client, 'grant', { county: '49035' }, new Date('2026-10-14T00:00:00Z'), { userId: 'u1', orgId: 'o1' }, 'preview');
    expect(calls).toEqual(expect.arrayContaining(['m1_court_to_first_session.county_fips=49035', 'm4_m5_m6_episodes.county_fips=49035', 'case', 'need_score_config']));
    expect(inserts).toEqual([{ table: 'export_job', org_id: 'o1', type: 'packet-html', params: { variant: 'grant', scope: { county: '49035' }, status: 'rendered', asOf: 'Data as of Not available yet' }, suppression_applied: true, created_by: 'u1' },
      { table: 'audit_log', org_id: 'o1', actor: 'u1', action: 'packet.render', entity: 'export_job', entity_id: 'job-1', details: expect.objectContaining({ variant: 'grant' }) }]);
    expect([p.scopeLabel, p.sections[0]?.paragraphs[0], assertPacket(p)]).toEqual(['Salt Lake County', 'The county need score is not available yet.', []]);
    inserts.length = 0;
    const board = await PacketQuery.load(client, 'board', { county: '49035' }, new Date('2026-10-14T00:00:00Z'), null, 'preview');
    expect([inserts, board.scopeLabel, board.sections[0]?.paragraphs[1]]).toEqual([[], 'Statewide', 'FAS service counties are not available yet.']);
  });
});
describe('DOCX and CSV exports (F-404)', () => {
  /** The three text rules of `assertPacket`, run over any list of strings (the DOCX text or the CSV). */
  const scan = (texts: string[]) => texts.flatMap((t) => [...t.matchAll(EXACT_DATE), ...t.matchAll(CASE_FIELDS), ...t.matchAll(/\bn = (\d+)\b|\((\d+) of (\d+)\)/g)].map((m) => m[0]));
  it('docxText carries every model string, passes the exact-date / small-cell / case-field checks on the golden packets, and catches an injected violation', async () => {
    for (const p of [buildPacket(input()), buildPacket(input({ variant: 'board' })), buildPacket(input({ scope: {}, need: null, method: null, metrics: null }))]) {
      const text = docxText(p), joined = text.join('\n');
      expect(scan(text)).toEqual([]);
      for (const t of renderText(p)) expect(joined).toContain(t.includes(' · as of ') ? t.split(': ')[0] : t);
      expect([text[0], text[1], text[2], text.at(-1)]).toEqual(['DRAFT · for review', p.title, `${p.prepared} · ${p.asOf}`, p.footer]);
    }
    const bad = buildPacket(input()); bad.sections[1]?.paragraphs.push('Court order dated 2024-07-01 for case_id 12 (3 of 14).');
    expect(scan(docxText(bad))).toEqual(['2024-07-01', 'case_id', '(3 of 14)']);
    const bytes = await packetToDocx(buildPacket(input()));
    expect([bytes[0], bytes[1], bytes.length > 4000]).toEqual([0x50, 0x4b, true]);
  });
  it('CSV: BOM + header, one row per figure, suppressed figures carry fewer_than_11 / hidden with an empty value, RFC 4180 quoting, no exact dates', () => {
    const p = buildPacket(input()), csv = packetToCsv(p), lines = csv.split('\r\n'), figures = p.sections.flatMap((s) => s.figures);
    expect([csv.startsWith(BOM), lines[0], lines.length - 2, lines.at(-1)]).toEqual([true, BOM + CSV_HEADER.join(','), figures.length, '']);
    const rows = csvRows(p), m2 = rows.find((r) => r[1]?.startsWith('Days from application'));
    expect(m2).toEqual(['FAS results', m2?.[1], '', '', 'FAS records · Jul–Sep 2024 (Q3)', 'Oct 2024', 'fewer_than_11']);
    expect(rows[0]).toEqual(['County need profile', 'Uninsured rate', '9.1% ± 0.4', 'percent', 'Census SAHIE 2023', 'Oct 2026', 'shown']);
    expect(rows.every((r) => r.length === 7 && (r[6] === 'shown' ? r[2] !== '' : r[2] === '' && r[3] === ''))).toBe(true);
    expect(rows.filter((r) => r[6] === 'fewer_than_11').length).toBeGreaterThan(0);
    expect(scan(lines)).toEqual([]);
    expect(csv).not.toMatch(/Connections Counseling|Counts under 11 are hidden/);
    expect([csvCell('a,b'), csvCell('say "hi"'), csvCell('x\ny'), csvCell('plain')]).toEqual(['"a,b"', '"say ""hi"""', '"x\ny"', 'plain']);
    const hidden = buildPacket(input()); hidden.sections[1]?.figures.push({ label: 'Cases', value: 'hidden', kind: 'count', sourceLabel: 'FAS records', asOf: 'Oct 2024' });
    expect(csvRows(hidden).find((r) => r[1] === 'Cases')?.slice(2)).toEqual(['', '', 'FAS records', 'Oct 2024', 'hidden']);
  });
  it('filenames carry the month only and the scope slug; renderExport pairs body, MIME and name', async () => {
    const now = new Date('2026-10-14T12:00:00Z'), g = buildPacket(input()), b = buildPacket(input({ variant: 'board' }));
    expect([exportFilename(g, 'docx', now), exportFilename(b, 'csv', now)]).toEqual(['fas-evidence-packet-grant-salt-lake-county-2026-10.docx', 'fas-evidence-packet-board-statewide-2026-10.csv']);
    const csv = await renderExport(g, 'csv', now), docx = await renderExport(g, 'docx', now);
    expect([csv.mime, new TextDecoder('utf-8', { ignoreBOM: true }).decode(csv.body).startsWith(BOM), docx.mime.includes('wordprocessingml'), docx.body[0]]).toEqual(['text/csv; charset=utf-8', true, true, 0x50]);
  });
});
