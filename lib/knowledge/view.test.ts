import { describe, expect, it } from 'vitest';
import { applyFilters, CONFIRM_LABEL, editorWords, groupByCategory, type ListRow, monthYear, parseFilters, parseForm } from './view';

const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const OK = { confirm: 'yes', category: 'mission', title: 'Mission (fictional)', body: 'Bluebird Family Fund is a made-up nonprofit.', source: '', as_of: '' };
const row = (id: string, category: ListRow['category'], status: ListRow['status']): ListRow =>
  ({ id, category, status, title: id, body: 'x', source: null, as_of: null, version: 1, updated_at: '2026-10-16T00:00:00Z', history: [] });

describe('F-508c knowledge view helpers', () => {
  it('parseForm requires the privacy checkbox and a known category', () => {
    expect(parseForm(form({ ...OK, confirm: '' }))).toEqual({ ok: false, message: `Not saved: tick "${CONFIRM_LABEL}"` });
    expect(parseForm(form({ ...OK, category: 'clients' }))).toEqual({ ok: false, message: 'Not saved: choose a category.' });
    expect(parseForm(form({ ...OK, id: 'abc' }))).toEqual({ ok: true, id: 'abc', fields: { category: 'mission', title: OK.title, body: OK.body, source: null, as_of: null } });
  });

  it('names the matched rule in plain words and never echoes the text', () => {
    const phone = '801-555-0142';
    const r = parseForm(form({ ...OK, body: `Call the family at ${phone}` }));
    expect(r).toEqual({ ok: false, message: 'Not saved: the text contains a phone number. Store org-level facts only.' });
    expect(JSON.stringify(r)).not.toContain(phone);
    expect(parseForm(form({ ...OK, source: 'Report by a.person@example.test' }))).toEqual({ ok: false, message: 'Not saved: the source contains an email address. Store org-level facts only.' });
    expect(parseForm(form({ ...OK, category: 'outcome', body: '7 in 10 completed' }))).toMatchObject({ ok: false, message: expect.stringContaining('no source and as-of date') });
  });

  it('filters, groups in category order and words dates and editors', () => {
    const rows = [row('a', 'outcome', 'approved'), row('b', 'mission', 'draft'), row('c', 'mission', 'archived')];
    expect(parseFilters({ category: 'mission', status: 'nope' })).toEqual({ category: 'mission', status: 'all' });
    expect(applyFilters(rows, { category: 'mission', status: 'draft' }).map((r) => r.id)).toEqual(['b']);
    expect(groupByCategory(rows).map((g) => [g.label, g.rows.length])).toEqual([['Mission', 2], ['Outcomes', 1]]);
    expect(monthYear('2025-12-31')).toBe('Dec 2025');
    expect(monthYear(null)).toBeNull();
    expect([editorWords(null, 'u1'), editorWords('u1', 'u1'), editorWords('u2', 'u1')]).toEqual(['the setup import', 'you', 'another admin']);
  });
});
