import { describe, expect, it } from 'vitest';
import { buildDigest, digestThreshold, selectNew, sinceDate, type DigestRow } from './digest';

const NOW = new Date('2026-10-19T09:30:00Z');
const row = (over: Partial<DigestRow>): DigestRow => ({ id: 'r', title: 'T', funder: 'F', closeDate: '2026-12-01', postedDate: '2026-10-15', computedAt: '2026-10-19T09:00:00Z', score: 70, eligibility: 'Eligible', ...over });

describe('digest threshold and window', () => {
  it('reads digest_threshold, then eval_threshold, then 60', () => {
    expect([digestThreshold({ digest_threshold: 75, eval_threshold: 50 }), digestThreshold({ eval_threshold: 50 }), digestThreshold({}), digestThreshold(null), digestThreshold({ digest_threshold: 'x' })]).toEqual([75, 50, 60, 60, 60]);
  });
  it('window starts `days` back as a date', () => {
    expect([sinceDate(NOW), sinceDate(NOW, 30)]).toEqual(['2026-10-12', '2026-09-19']);
  });
});

describe('selectNew', () => {
  it('keeps open matches at or above the threshold that were posted in the window, best score first', () => {
    const rows = [
      row({ id: 'a', score: 60, title: 'B' }), row({ id: 'b', score: 60, title: 'A' }), row({ id: 'low', score: 59.9 }),
      row({ id: 'old', postedDate: '2026-10-11' }), row({ id: 'future', postedDate: '2026-10-20' }),
      row({ id: 'closed', closeDate: '2026-10-18' }), row({ id: 'noclose', closeDate: null, score: 90 }),
    ];
    expect(selectNew(rows, NOW, 60).map((r) => r.id)).toEqual(['noclose', 'b', 'a']);
  });
  it('without a posted date, first scored inside the window counts as new', () => {
    const rows = [row({ id: 'fresh', postedDate: null, computedAt: '2026-10-12T00:00:00Z' }), row({ id: 'stale', postedDate: null, computedAt: '2026-10-11T23:59:59Z' })];
    expect(selectNew(rows, NOW, 60).map((r) => r.id)).toEqual(['fresh']);
  });
});

describe('buildDigest', () => {
  it('renders subject, text and html from stored rows only, escaping html', () => {
    const d = buildDigest([row({ title: 'Family <Therapy> Fund', score: 82.4, funder: null, closeDate: null })], NOW, { digest_threshold: 65 });
    expect([d.count, d.threshold, d.since, d.subject]).toEqual([1, 65, '2026-10-12', 'FAS Evidence · 1 new grant match this week']);
    expect(d.text).toContain('- Family <Therapy> Fund · Funder not recorded · closes no close date · fit 82 · Eligible');
    expect(d.text).toContain('since Oct 12, 2026');
    expect(d.html).toContain('<li>Family &lt;Therapy&gt; Fund · Funder not recorded · closes no close date · fit 82 · Eligible</li>');
    expect(d.html).not.toContain('<Therapy>');
  });
  it('says so when nothing is new', () => {
    const d = buildDigest([row({ score: 10 })], NOW, {});
    expect([d.count, d.subject]).toEqual([0, 'FAS Evidence · 0 new grant matches this week']);
    expect(d.text).toContain('No new matches above the threshold this week.');
    expect(d.html).toContain('<p>No new matches above the threshold this week.</p>');
  });
});
