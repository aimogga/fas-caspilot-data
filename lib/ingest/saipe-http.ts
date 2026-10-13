import { Saipe } from '../../packages/ingest/saipe';
import { SahieHttp, type IngestHttpDeps, type SahieRunOpts } from './sahie-http';

/** n8n entry: fetch → parse → requireComplete → load, on the shared SahieHttp skeleton. */
export class SaipeHttp {
  static year(now: Date, requested?: string): string {
    if (requested !== undefined) return SahieHttp.year(now, requested);
    return String(now.getUTCFullYear() - (now.getUTCMonth() === 11 ? 1 : 2));
  }

  static async run(opts: SahieRunOpts) {
    const year = SaipeHttp.year(opts.now ?? new Date(), opts.year);
    return SahieHttp.ingest(Saipe, opts, async (env) =>
      Saipe.requireComplete(Saipe.parse(await Saipe.fetch(year, env, opts.httpFetch))));
  }

  static handle(request: Request, deps: IngestHttpDeps = {}): Promise<Response> {
    return SahieHttp.respond(request, Saipe.SOURCE_NAME, SaipeHttp.run.bind(SaipeHttp), deps);
  }
}
