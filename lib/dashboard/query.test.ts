import { describe, expect, it } from 'vitest';
import { DashboardQuery, STAGES, type PipelineRow } from './query';

const NOW = new Date('2026-10-13T12:00:00Z');
const row = (status: string, source = 'grants_gov', close_date: string | null = null, title = 'Synth Opp', posted_date: string | null = null): PipelineRow =>
  ({ status, opportunity: { id: title, title, source, close_date, posted_date } });

describe('pipeline widget query (DS-07a)', () => {
  it('keeps the seven stages in order, matches case-insensitively, ignores other statuses and tags manual entries', () => {
    const view = DashboardQuery.pipeline([row('watch'), row('PURSUING', 'foundation_manual', '2027-03-01', 'Synthetic Family Fund', '2026-10-01'), row(' new ')], [], NOW);
    expect(view.stages.map((s) => s.name)).toEqual([...STAGES]);
    expect(view.stages.map((s) => `${s.count}/${s.manual}`)).toEqual(['1/0', '0/0', '1/1', '0/0', '0/0', '0/0', '0/0']);
    expect([view.manualCount, view.empty]).toEqual([1, false]);
    expect(view.deadline).toBe('Next deadline: Synthetic Family Fund, closes Mar 1');
    expect(view.footer).toBe('Grants.gov and foundation lists · as of Oct 2026 · includes 1 manual entries');
  });

  it('is empty with only unknown statuses; picks the earliest future deadline; prefers a grants source as-of; copes with a missing opportunity', () => {
    const none = DashboardQuery.pipeline([row('watch')], [], NOW);
    expect([none.empty, none.deadline, none.footer]).toEqual([true, 'No upcoming deadline', 'Grants.gov and foundation lists · as of Not available yet']);
    const rows = [row('submitted', 'grants_gov', '2026-01-01', 'Past'), row('new', 'grants_gov', '2027-06-30', 'Later'), row('reviewing', 'grants_gov', '2026-11-05', 'Soon')];
    const sources = [{ name: 'grants-gov', last_success_at: '2026-09-15T00:00:00Z' }, { name: 'census-sahie', last_success_at: '2026-10-01T00:00:00Z' }];
    const view = DashboardQuery.pipeline(rows, sources, NOW);
    expect([view.deadline, view.footer]).toEqual(['Next deadline: Soon, closes Nov 5', 'Grants.gov and foundation lists · as of Sep 2026']);
    expect(DashboardQuery.pipeline([{ status: 'new', opportunity: null }], [], NOW).stages[0]?.count).toBe('1');
  });
});
