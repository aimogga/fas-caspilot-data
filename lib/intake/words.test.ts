import { describe, expect, it } from 'vitest';
import { GLOSSARY } from '../trust/glossary';
import { controlFor } from './entry';
import { INTAKE_ENTITIES, INTAKE_SCHEMA } from './schema';
import { AGGREGATE_BADGE_HINT, AGGREGATE_HELP, AGGREGATE_SOURCE, aggregateCell, countyWords, FIELD_HELP, fieldHelp } from './words';

const BANNED = /\b(N\/A|null|undefined|NaN|pct|FIPS|MOE|TBD|lorem|CasePilot)\b|!|M[1-6]\b/;
const COUNTIES = [{ fips: '49035', name: 'Salt Lake' }];

describe('DS-18b field helper words', () => {
  it('every visible field of every entity gets one or two plain sentences; hidden ids get none', () => {
    for (const e of INTAKE_ENTITIES) {
      for (const f of INTAKE_SCHEMA[e].fields) {
        const help = fieldHelp(f);
        if (controlFor(f) === 'hidden') { expect(help, f.key).toBeNull(); continue; }
        expect(help, `${e}.${f.key}`).toMatch(/^[A-Z].*\.$/);
        expect((help ?? '').split(/\. /).length, `${e}.${f.key} sentences`).toBeLessThanOrEqual(2);
        expect(help, `${e}.${f.key}`).not.toMatch(BANNED);
      }
    }
  });
  it('dates name the day format and order, money the dollar format, counts the floor, ids the parent and the Copy id button', () => {
    expect(fieldHelp(INTAKE_SCHEMA.application.fields[3])).toContain('like 2024-03-31. It must be on or after the application date');
    expect(fieldHelp(INTAKE_SCHEMA.application.fields[5])).toContain('in dollars, like 1840.00');
    expect(fieldHelp(INTAKE_SCHEMA.delivery.fields[4])).toContain('as a whole number of 0 or more');
    expect(fieldHelp(INTAKE_SCHEMA.authorization.fields[3])).toBe('Paste the id of the saved provider this belongs to. It appears after you save a provider, with a Copy id button, and must be in your organization.');
    expect(fieldHelp({ key: 'other_date', label: 'Other', type: 'date' })).toBe('A date as year-month-day, like 2024-03-31.');
    expect(Object.keys(FIELD_HELP).every((k) => INTAKE_ENTITIES.some((e) => INTAKE_SCHEMA[e].fields.some((f) => f.key === k)))).toBe(true);
  });
  it('required fields say so; the fields that feed a glossary metric say which', () => {
    const required = INTAKE_ENTITIES.flatMap((e) => INTAKE_SCHEMA[e].fields.filter((f) => f.required && f.type !== 'uuid_ref'));
    for (const f of required) expect(fieldHelp(f), f.key).toContain('Required');
    expect(FIELD_HELP.court_order_date).toContain('wait to a first session');
    expect(FIELD_HELP.application_date).toContain('time to a funding decision');
    expect(FIELD_HELP.discharge_status).toContain('completion rate');
    expect(FIELD_HELP.dollars_paid).toContain('cost per completed episode');
  });
});

describe('DS-18b aggregate words', () => {
  it('the badge hint is the glossary sentence; a cell carries the term, the total in words and the source, never an as-of', () => {
    expect(AGGREGATE_BADGE_HINT).toBe(GLOSSARY.aggregate.plain);
    const cell = aggregateCell({ period: '2026-Q2', metric_code: 'dollars_paid', value: '1840.5', county_fips: '49035' }, COUNTIES);
    expect(cell).toEqual({ 'data-term': 'aggregate', 'data-value': '$1,840.50 dollars paid to providers, Apr–Jun 2026 (Q2), Salt Lake', 'data-source': AGGREGATE_SOURCE });
    expect(aggregateCell({ period: '2025-Q4', metric_code: 'families_served', value: 31, county_fips: null }, COUNTIES)['data-value']).toBe('31 families served, Oct–Dec 2025 (Q4), All counties');
    expect(countyWords('49049', COUNTIES)).toBe('49049');
  });
  it('DS-25: every aggregate field has one or two plain sentences naming its rule; required fields say so', () => {
    expect(Object.keys(AGGREGATE_HELP).sort()).toEqual(['county_fips', 'metric', 'note', 'period', 'value']);
    for (const [k, help] of Object.entries(AGGREGATE_HELP)) {
      expect(help, k).toMatch(/^[A-Z].*\.$/);
      expect(help.split(/\. /).length, k).toBeLessThanOrEqual(2);
      expect(help, k).not.toMatch(BANNED);
    }
    for (const k of ['period', 'metric', 'value'] as const) expect(AGGREGATE_HELP[k], k).toContain('Required');
    expect(AGGREGATE_HELP.period).toContain('like 2026-Q2');
    expect(AGGREGATE_HELP.value).toContain('as a whole number of 0 or more');
    expect(AGGREGATE_HELP.note).toContain('up to 200 characters');
  });
});
