import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IngestAlertPayload } from '../../packages/ingest/ingest-alert';
import { isPublicRoute } from '../auth/role-guards';
import { FAS_UEI, SamRegistration, WARN_DAYS } from './sam-registration-http';

// SAM.gov registration check. Synthetic API responses only; no network.
const NOW = new Date('2026-10-17T12:00:00Z');
const entity = (status: string | null, expires: string | null) => ({ totalRecords: 1, entityData: [{ entityRegistration: { ueiSAM: FAS_UEI, legalBusinessName: 'FAMILY ADVOCACY SERVICES', registrationStatus: status, registrationExpirationDate: expires } }] });
const ok = (body: unknown): typeof fetch => async () => new Response(JSON.stringify(body), { status: 200 });
const env = { INGEST_TOKEN: 'tok-secret', SAM_API_KEY: 'fake-k-99', INGEST_ALERT_WEBHOOK_URL: 'http://127.0.0.1/hook' };
const req = (token?: string) => new Request('http://127.0.0.1/api/ingest/sam-registration', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {} });
const alerts = () => {
  const sent: IngestAlertPayload[] = [];
  const alertFetch: typeof fetch = async (_u, init) => { sent.push(JSON.parse(String(init?.body)) as IngestAlertPayload); return new Response(null, { status: 200 }); };
  return { sent, alertFetch };
};

afterEach(() => vi.restoreAllMocks());

describe('SamRegistration.evaluate', () => {
  it('no alert while Active and more than 60 days out; alert at exactly 60 days and below', () => {
    expect(SamRegistration.evaluate(entity('Active', '2027-09-15'), FAS_UEI, NOW)).toMatchObject({ status: 'Active', expires: '2027-09-15', daysLeft: 332, alert: null });
    const at60 = new Date(Date.parse('2027-09-15T00:00:00Z') - WARN_DAYS * 86_400_000);
    expect(SamRegistration.evaluate(entity('Active', '2027-09-15'), FAS_UEI, at60).alert).toBe(`SAM.gov registration for ${FAS_UEI} expires 2027-09-15 (60 days left): renew at sam.gov`);
    expect(SamRegistration.evaluate(entity('Active', '2026-10-01'), FAS_UEI, NOW).daysLeft).toBe(-17);
  });

  it('alerts when not Active, when no record comes back, or when the date is unreadable', () => {
    expect(SamRegistration.evaluate(entity('Inactive', '2027-09-15'), FAS_UEI, NOW).alert).toMatch(/is Inactive, not Active/);
    expect(SamRegistration.evaluate({ totalRecords: 0, entityData: [] }, FAS_UEI, NOW).alert).toBe(`No SAM.gov registration found for UEI ${FAS_UEI}`);
    expect(SamRegistration.evaluate(entity('Active', '09/15/2027'), FAS_UEI, NOW).alert).toMatch(/no readable expiration date/);
  });
});

describe('SamRegistration.handle', () => {
  it('rejects a missing or wrong token before calling SAM', async () => {
    const httpFetch = vi.fn();
    for (const token of [undefined, 'nope']) expect((await SamRegistration.handle(req(token), { env, httpFetch })).status).toBe(401);
    expect(httpFetch).not.toHaveBeenCalled();
  });

  it('sends the key as a header, never in the URL; healthy registration returns 200 and no alert', async () => {
    const { sent, alertFetch } = alerts();
    let url = '', key = '';
    const httpFetch: typeof fetch = async (u, init) => { url = String(u); key = new Headers(init?.headers).get('x-api-key') ?? ''; return ok(entity('Active', '2027-09-15'))(u); };
    const res = await SamRegistration.handle(req('tok-secret'), { env, now: NOW, httpFetch, alertFetch });
    expect([res.status, await res.json()]).toEqual([200, expect.objectContaining({ ok: true, uei: FAS_UEI, daysLeft: 332, alert: null })]);
    expect([url.includes('ueiSAM=CZ9FYJUKH2S9'), url.includes('fake-k'), key, sent]).toEqual([true, false, env.SAM_API_KEY, []]);
  });

  it('a registration inside the window still returns 200 and raises one alert', async () => {
    const { sent, alertFetch } = alerts();
    const res = await SamRegistration.handle(req('tok-secret'), { env, now: NOW, httpFetch: ok(entity('Active', '2026-11-30')), alertFetch });
    expect(res.status).toBe(200);
    expect(sent).toEqual([expect.objectContaining({ source: 'sam-registration', status: 'error', error: expect.stringContaining('expires 2026-11-30 (43 days left)') })]);
  });

  it('a missing key or a failed SAM call alerts and returns 500 without leaking the key or token', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = alerts();
    expect((await SamRegistration.handle(req('tok-secret'), { env: { ...env, SAM_API_KEY: '' }, alertFetch: a.alertFetch })).status).toBe(500);
    expect(a.sent[0]?.error).toBe('SAM_API_KEY is not set');
    const b = alerts();
    expect((await SamRegistration.handle(req('tok-secret'), { env, httpFetch: async () => new Response('x', { status: 403 }), alertFetch: b.alertFetch })).status).toBe(500);
    expect(b.sent[0]?.error).toBe('SAM request failed: 403');
    for (const s of [env.SAM_API_KEY, env.INGEST_TOKEN]) expect(JSON.stringify([log.mock.calls, a.sent, b.sent])).not.toContain(s);
  });
});

it('route is token-only (public to the session guard) and the n8n workflow is inactive, weekly, with the ingest credential and no key', () => {
  expect(isPublicRoute('/api/ingest/sam-registration')).toBe(true);
  const text = readFileSync('n8n/sam-registration-weekly.json', 'utf8');
  const wf = JSON.parse(text) as { active: boolean; nodes: { type: string }[] };
  expect(wf.active).toBe(false);
  expect(wf.nodes.map((n) => n.type).sort()).toEqual(['n8n-nodes-base.httpRequest', 'n8n-nodes-base.scheduleTrigger']);
  for (const s of ['https://fas-caspilot-data.vercel.app/api/ingest/sam-registration', '"httpHeaderAuth":{"id":"hJd3gjSOX9o2ITvB","name":"FAS ingest token"}', '"7 15 * * 1"']) expect(text).toContain(s);
  expect(text).not.toMatch(/SAM_API_KEY|api_key|\$env\./);
});
