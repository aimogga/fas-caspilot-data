import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PoliteFetcher, USER_AGENT, robotsAllows } from './polite-fetch';
const OVC = readFileSync('tests/fixtures/ojp_awards/robots-ovc.txt', 'utf8'); // live ovc.ojp.gov/robots.txt, 2026-10-15
describe('unit: polite fetch (robots.txt, 1 request/second/host, User-Agent)', () => {
  it('reads the live OVC robots.txt: award pages allowed, sign-in and search disallowed; wildcards, $ and longest match', () => {
    expect(['/funding/awards/15povc-24-gk-01063-ht', '/user/login', '/search/x', '/core/a.css', '/core/a.php'].map((p) => robotsAllows(OVC, p))).toEqual([true, false, false, true, false]);
    const r = 'User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nUser-agent: FAS-Evidence\nDisallow: /private\nAllow: /private/ok$\n';
    expect(['/', '/private/x', '/private/ok', '/private/ok/2'].map((p) => robotsAllows(r, p))).toEqual([true, false, true, false]);
    expect([robotsAllows('', '/x'), robotsAllows('User-agent: *\nDisallow:\n', '/x')]).toEqual([true, true]);
  });
  it('robots.txt once per host, then requests one second apart per host (other hosts do not wait), with the User-Agent and manual redirects', async () => {
    let t = 0; const sleeps: number[] = [], calls: { url: string; ua: string | null; redirect?: string }[] = [];
    const f = new PoliteFetcher({ now: () => t, sleep: async (ms) => { sleeps.push(ms); t += ms; }, httpFetch: async (url, init) => {
      calls.push({ url: String(url), ua: new Headers(init?.headers).get('User-Agent'), redirect: init?.redirect });
      return new Response(String(url).endsWith('robots.txt') ? 'User-agent: *\nDisallow: /no' : 'ok'); } });
    await f.get('https://a.example/1'); await f.get('https://a.example/2'); await f.get('https://b.example/1');
    expect(calls.map((c) => c.url)).toEqual(['https://a.example/robots.txt', 'https://a.example/1', 'https://a.example/2', 'https://b.example/robots.txt', 'https://b.example/1']);
    expect([sleeps, calls.every((c) => c.ua === USER_AGENT && c.redirect === 'manual')]).toEqual([[1000, 1000, 1000], true]);
    await expect(f.get('https://a.example/no/x')).rejects.toThrow('robots.txt disallows https://a.example/no/x');
    expect(calls).toHaveLength(5);
  });
  it('a 403 or unreachable robots.txt disallows everything; a 404 allows', async () => {
    const mk = (robots: () => Promise<Response>) => new PoliteFetcher({ sleep: async () => {}, httpFetch: async (u) => (String(u).endsWith('robots.txt') ? robots() : new Response('ok')) });
    await expect(mk(async () => new Response('', { status: 403 })).get('https://c.example/x')).rejects.toThrow(/robots/);
    await expect(mk(async () => { throw new Error('down'); }).get('https://c.example/x')).rejects.toThrow(/robots/);
    expect((await mk(async () => new Response('', { status: 404 })).get('https://c.example/x')).status).toBe(200);
  });
});
