import { IngestAlert } from '../../packages/ingest/ingest-alert';
import { SahieHttp } from './sahie-http';

/** FAS's UEI: a public SAM.gov identifier, not client data (verified Active 2026-10-17, docs/research/sam_entity.md). */
export const FAS_UEI = 'CZ9FYJUKH2S9';
/** George (2026-10-17): warn 60 days before the registration lapses; without it FAS can't receive federal grants. */
export const WARN_DAYS = 60;
export type SamCheck = { uei: string; name: string | null; status: string | null; expires: string | null; daysLeft: number | null; alert: string | null };
type Deps = { env?: Record<string, string | undefined>; now?: Date; httpFetch?: typeof fetch; alertFetch?: typeof fetch };

/** n8n entry (weekly): read FAS's SAM.gov registration and raise the ingest alert when it is not Active or expires within WARN_DAYS. */
export class SamRegistration {
  static readonly SOURCE_NAME = 'sam-registration';

  /** The key goes in the X-Api-Key header, never the URL, so it can't leak into logs or error text. */
  static async fetch(uei: string, env: Record<string, string | undefined>, httpFetch: typeof fetch = fetch): Promise<unknown> {
    if (!env.SAM_API_KEY) throw new Error('SAM_API_KEY is not set');
    const res = await httpFetch(`https://api.sam.gov/entity-information/v3/entities?ueiSAM=${encodeURIComponent(uei)}`, { headers: { 'X-Api-Key': env.SAM_API_KEY } });
    if (!res.ok) throw new Error(`SAM request failed: ${res.status}`);
    return res.json();
  }

  static evaluate(json: unknown, uei: string, now: Date): SamCheck {
    const list = (json as { entityData?: unknown } | null)?.entityData;
    const reg = (Array.isArray(list) ? (list[0] as { entityRegistration?: Record<string, unknown> } | undefined)?.entityRegistration : undefined) ?? null;
    const str = (k: string) => (typeof reg?.[k] === 'string' && reg[k] ? (reg[k] as string) : null);
    const [name, status, expires] = [str('legalBusinessName'), str('registrationStatus'), str('registrationExpirationDate')];
    const end = expires && /^\d{4}-\d{2}-\d{2}$/.test(expires) ? Date.parse(`${expires}T00:00:00Z`) : NaN;
    const daysLeft = Number.isNaN(end) ? null : Math.floor((end - now.getTime()) / 86_400_000);
    const alert = !reg ? `No SAM.gov registration found for UEI ${uei}`
      : status !== 'Active' ? `SAM.gov registration for ${uei} is ${status ?? 'unknown'}, not Active`
        : daysLeft === null ? `SAM.gov registration for ${uei} has no readable expiration date`
          : daysLeft <= WARN_DAYS ? `SAM.gov registration for ${uei} expires ${expires} (${daysLeft} days left): renew at sam.gov` : null;
    return { uei, name, status, expires, daysLeft, alert };
  }

  static async handle(request: Request, deps: Deps = {}): Promise<Response> {
    const env = deps.env ?? process.env, source = SamRegistration.SOURCE_NAME;
    if (!SahieHttp.tokenOk(request, env)) return Response.json({ error: 'unauthorized' }, { status: 401 });
    const uei = env.FAS_UEI || FAS_UEI;
    try {
      const check = SamRegistration.evaluate(await SamRegistration.fetch(uei, env, deps.httpFetch), uei, deps.now ?? new Date());
      if (check.alert) await IngestAlert.notify(IngestAlert.payload(source, new Error(check.alert), env, null), env, deps.alertFetch);
      return Response.json({ ok: true, ...check });
    } catch (e) {
      const p = IngestAlert.payload(source, e, env, null);
      console.error('[ingest] failed', { source, stage: 'run', message: p.error });
      await IngestAlert.notify(p, env, deps.alertFetch);
      return Response.json({ error: 'check failed' }, { status: 500 });
    }
  }
}
