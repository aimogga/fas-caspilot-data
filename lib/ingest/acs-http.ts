import { Acs5 } from '../../packages/ingest/acs5';
import { SahieHttp, type IngestHttpDeps, type SahieRunOpts } from './sahie-http';

/** n8n entry: fetch → parse → requireComplete → load, on the shared SahieHttp skeleton. */
export class AcsHttp {
  static year(now: Date, requested?: string): string {
    if (requested !== undefined) return SahieHttp.year(now, requested);
    return String(now.getUTCFullYear() - (now.getUTCMonth() >= 10 ? 1 : 2));
  }

  static async run(opts: SahieRunOpts) {
    let year = AcsHttp.year(opts.now ?? new Date(), opts.year);
    const httpFetch = opts.httpFetch ?? fetch;
    return SahieHttp.ingest(Acs5, opts, async (env) => {
      let json: unknown;
      try {
        json = await Acs5.fetch(year, env, httpFetch);
      } catch {
        const fallback = String(Number(year) - 1);
        json = await Acs5.fetch(fallback, env, httpFetch);
        year = fallback;
      }
      return Acs5.requireComplete(Acs5.parse(json), year);
    });
  }

  static handle(request: Request, deps: IngestHttpDeps = {}): Promise<Response> {
    return SahieHttp.respond(request, Acs5.SOURCE_NAME, AcsHttp.run.bind(AcsHttp), deps);
  }
}
