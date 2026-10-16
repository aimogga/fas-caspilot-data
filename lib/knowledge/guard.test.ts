import { describe, expect, it } from 'vitest';
import { BODY_MAX, checkKnowledge, checkKnowledgeText } from './guard';

const rulesOf = (body: string) => { const r = checkKnowledgeText(body); return r.ok ? [] : r.rules; };

describe('checkKnowledgeText', () => {
  it('passes clean org-level paragraphs', () => {
    expect(checkKnowledgeText('Bluebird Family Fund (fictional) pays licensed therapists so families in five Utah counties can start counseling '
      + 'within weeks of a referral. Families pay on a sliding scale; no family is turned away.')).toEqual({ ok: true });
    expect(checkKnowledgeText('We served 412 families in 2025 across 5 counties with 18 contracted therapists.')).toEqual({ ok: true });
  });

  it.each([
    ['ssn', 'Client SSN on file: 078-05-1120.'], ['ssn', 'Number 078 05 1120 was given at intake.'],
    ['date_of_birth', 'The child, DOB 4/2/2015, was referred.'], ['date_of_birth', 'Her date of birth is in the file.'],
    ['phone', 'Call the mother at (801) 555-0142.'], ['phone', 'Reach him on 801.555.0199 after 5.'],
    ['email', 'Write to jane.doe@example.com for records.'],
    ['street_address', 'The family lives at 123 Maple Street in Ogden.'], ['street_address', 'Moved to 1234 S 500 E last spring.'],
    ['case_number', 'Referred under case no. 241900123.'], ['case_number', 'See docket #A-7731.'], ['case_number', 'Order in 24-JV-00123.'],
  ] as const)('rejects %s: %s', (rule, text) => expect(rulesOf(text)).toContain(rule));

  it('names the rules and never echoes the text', () => {
    const r = checkKnowledgeText('Mother: jane.doe@example.com, (801) 555-0142');
    expect(r).toMatchObject({ ok: false, rules: ['phone', 'email'] });
    expect(JSON.stringify(r)).not.toMatch(/jane|555|801/);
  });

  it('rejects empty and over-long text', () => {
    expect([rulesOf('   '), rulesOf('a'.repeat(BODY_MAX + 1)), rulesOf('a'.repeat(BODY_MAX))]).toEqual([['empty'], ['too_long'], []]);
  });
});

describe('checkKnowledge', () => {
  const f = { category: 'outcome' as const, title: 'Completion', body: '72% of families finished 8 sessions.' };
  const src = { source: 'Fictional annual report', as_of: '2025-12-31' };
  it.each([
    ['outcome without source', f, false], ['outcome without as_of', { ...f, ...src, as_of: null }, false],
    ['blank source', { ...f, ...src, source: ' ' }, false], ['budget without source', { ...f, category: 'budget' as const }, false],
    ['outcome with source and as_of', { ...f, ...src }, true], ['mission with numbers', { ...f, category: 'mission' as const }, true],
    ['outcome without numbers', { ...f, body: 'Most families finish their sessions.' }, true],
  ])('numbers need source and as_of: %s', (_n, input, ok) => {
    expect(checkKnowledge(input)).toEqual(ok ? { ok: true } : expect.objectContaining({ rules: ['needs_source'] }));
  });

  it('checks the title too and merges rules', () => {
    expect(checkKnowledge({ category: 'other', title: 'Call (801) 555-0142', body: 'jane.doe@example.com' })).toMatchObject({ ok: false, rules: ['phone', 'email'] });
  });
});
