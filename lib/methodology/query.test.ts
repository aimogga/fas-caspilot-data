import { describe, expect, it } from 'vitest';
import { MethodologyQuery, type MethodInput } from './query';

const SAHIE = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const ADMIN = '00000000-0000-4000-8000-000000000211';
const seed = (): MethodInput => ({
  configs: [
    { version: 'v1-poverty-uninsured', weights: { poverty_rate: 0.5, uninsured: 0.5 }, created_at: '2026-09-20', approved_by: null },
    { version: 'v2-synthetic', weights: { uninsured: 1 }, created_at: '2026-10-01', approved_by: ADMIN },
    { version: 'v3-draft', weights: { uninsured: 2 }, created_at: '2026-10-10', approved_by: null },
  ],
  scores: Array.from({ length: 26 }, (_, i) => ({ version: 'v2-synthetic', geo_fips: `490${String(i * 2 + 1).padStart(2, '0')}`, score: 0 })),
  indicators: ['2023', '2022'].map((vintage) => ({ source_id: SAHIE, indicator_code: 'uninsured', geo_fips: '49035', value: 0.1, moe: null, unit: 'rate', vintage })),
  sources: [{ id: SAHIE, name: 'census-sahie', last_success_at: '2026-10-05T00:00:00Z' }],
});

describe('F-210 methodology query', () => {
  it('builds the newest approved view from the seed shapes and names the newest later draft', () => {
    const view = MethodologyQuery.build(seed(), 'production');
    expect(view?.version).toBe('v2-synthetic');
    expect([view?.approvedLabel, view?.synthetic, view?.singleInput]).toEqual(['Oct 2026', true, true]);
    expect(view?.inputs).toEqual([{ key: 'uninsured', label: 'Uninsured rate', known: true, source: 'Census SAHIE', vintage: '2023', asOf: 'Oct 2026', status: 'current' }]);
    expect([view?.weights, view?.sum, view?.mismatch]).toEqual([[{ key: 'uninsured', label: 'Uninsured rate', known: true, weight: '1', share: '100%' }], '1', null]);
    expect(view?.notPublished).toBe('3 of 29 counties are Not published for this version.');
    expect(view?.footer).toBe('Public sources: Census SAHIE · Need score version v2-synthetic · as of Oct 2026 · Synthetic data');
    expect(view?.draft).toEqual({ version: 'v3-draft', createdLabel: 'Oct 2026' });
    expect(MethodologyQuery.draftFor(view!, 'board_viewer')).toBeNull();
    expect([MethodologyQuery.draftFor(view!, 'staff')?.version, MethodologyQuery.draftFor(view!, 'admin')?.version]).toEqual(['v3-draft', 'v3-draft']);
  });
  it('returns null with no approved config and no draft when none is newer', () => {
    const input = seed();
    input.configs = input.configs.filter((c) => c.version !== 'v3-draft');
    expect(MethodologyQuery.build(input, 'production')?.draft).toBeNull();
    input.configs = input.configs.filter((c) => c.approved_by === null);
    expect(MethodologyQuery.build(input, 'production')).toBeNull();
  });
  it('flags a weight sum that is not 1, labels unknown keys and counts Not published inputs', () => {
    const input = seed();
    input.configs[1] = { ...input.configs[1]!, version: 'v2-real', weights: { uninsured: 0.6, mystery: 0.2 } };
    input.scores = [];
    const view = MethodologyQuery.build(input, 'production');
    expect([view?.synthetic, MethodologyQuery.build(input, 'preview')?.synthetic]).toEqual([false, true]);
    expect([view?.sum, view?.mismatch]).toEqual(['0.8', 'Weights in this version do not sum to 1 (sum = 0.8).']);
    expect(view?.weights.map((w) => w.share)).toEqual(['75%', '25%']);
    expect(view?.inputs[1]).toMatchObject({ key: 'mystery', label: 'mystery', known: false, source: '—', vintage: '—', status: 'not_published' });
    expect(view?.notPublished).toBe('29 of 29 counties are Not published for this version.');
    expect(view?.footer).toBe('Public sources: Census SAHIE · Need score version v2-real · as of Oct 2026');
  });
});
