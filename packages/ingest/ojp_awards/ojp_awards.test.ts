import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OjpAwards, plainText, wordCount } from './index';
const page = (name: string) => readFileSync(`tests/fixtures/ojp_awards/${name}.html`, 'utf8');
describe('unit: OJP award page parser over saved (UNVERIFIED, hand-built) fixtures', () => {
  it('OVC page: award number and the full multi-paragraph abstract, entities decoded, word count', () => {
    const r = OjpAwards.parse(page('award-ovc-published'));
    expect(r).toEqual(expect.objectContaining({ status: 'published', award_number: '15POVC-24-GG-09999-NONF', word_count: 81 }));
    expect(r.status === 'published' && [r.text.startsWith('Example Family Services Inc will provide trauma-focused'), r.text.includes('juvenile court & child advocacy'), r.text.endsWith('CA/NCF')])
      .toEqual([true, true, true]);
  });
  it('OJJDP page (multi-line fields, numeric entities, <br>)', () => {
    expect(OjpAwards.parse(page('award-ojjdp-published'))).toEqual({ status: 'published', award_number: '15PJDP-23-GK-09998-MENT', word_count: 24,
      text: 'The Coalition’s project pairs youth on probation with trained mentors for 12 months. Mentors meet weekly; families get "navigation" help with school and counseling.' });
  });
  it('a page without the description section and a sign-in page are not_published with a reason, never blank', () => {
    expect(OjpAwards.parse(page('award-no-abstract'))).toEqual({ status: 'not_published', award_number: '15POVC-24-GG-09997-ASSI', reason: 'OJP award page has no published abstract' });
    expect(OjpAwards.parse('<html><head><title>Log in | Office for Victims of Crime</title></head></html>')).toEqual(expect.objectContaining({ status: 'not_published', reason: expect.stringMatching(/sign-in/) }));
  });
  it('a redesigned layout throws instead of storing junk', () => {
    expect(() => OjpAwards.parse(page('award-broken-layout'))).toThrow('layout not recognised');
    expect(() => OjpAwards.parse('')).toThrow('layout not recognised');
  });
  it('page URL from the FAIN (office subdomain, older numbers on www); DOJ/OJP only; text helpers', () => {
    expect([OjpAwards.pageUrl('15POVC22GG00810ASSI'), OjpAwards.pageUrl('15pjdp-23-gk-09998-ment'), OjpAwards.pageUrl('2016VAGX0052'), OjpAwards.pageUrl('15PXYZ22GG00810ASSI'), OjpAwards.pageUrl(null)])
      .toEqual(['https://ovc.ojp.gov/funding/awards/15povc-22-gg-00810-assi', 'https://ojjdp.ojp.gov/funding/awards/15pjdp-23-gk-09998-ment', 'https://www.ojp.gov/funding/awards/2016-va-gx-0052', null, null]);
    expect([OjpAwards.isOjp('DOJ', 'OJP'), OjpAwards.isOjp('DOJ', 'OVW'), OjpAwards.isOjp('HHS', 'ACF')]).toEqual([true, false, false]);
    expect([plainText('<p>a&nbsp;&#x41;</p><script>x()</script><p>b &bogus;</p>'), wordCount('  one two\nthree ')]).toEqual(['a A b &bogus;', 3]);
  });
});
