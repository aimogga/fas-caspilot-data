import { VaVetpop } from '../../packages/ingest/va_vetpop';
import { SahieHttp, type IngestHttpDeps, type SahieRunOpts } from './sahie-http';

/** n8n entry: fetch → parse (fill) → requireComplete → load. No year means the dataset's latest fiscal year. */
export class VetpopHttp {
  static async run(opts: SahieRunOpts) {
    const year = opts.year === undefined ? undefined : SahieHttp.year(opts.now ?? new Date(), opts.year);
    return SahieHttp.ingest(VaVetpop, opts, async (env) =>
      VaVetpop.requireComplete(VaVetpop.parse(await VaVetpop.fetch(year, env, opts.httpFetch))));
  }

  static handle(request: Request, deps: IngestHttpDeps = {}): Promise<Response> {
    return SahieHttp.respond(request, VaVetpop.SOURCE_NAME, VetpopHttp.run.bind(VetpopHttp), deps);
  }
}
