import { VaVetpop } from '../../packages/ingest/va_vetpop';
import { SahieHttp, type IngestHttpDeps, type SahieRunOpts } from './sahie-http';

/** n8n entry: fetch → parse (fill) → requireComplete → load. No year means FY2023 through the latest fiscal year that has ended
 * (never a projection); a year loads just that year. */
export class VetpopHttp {
  static async run(opts: SahieRunOpts) {
    const now = opts.now ?? new Date();
    const [from, to] = opts.year === undefined ? [VaVetpop.FIRST_YEAR, VaVetpop.fiscalYear(now)] : [SahieHttp.year(now, opts.year), SahieHttp.year(now, opts.year)];
    return SahieHttp.ingest(VaVetpop, opts, async (env) =>
      VaVetpop.requireComplete(VaVetpop.parse(await VaVetpop.fetch(from, to, env, opts.httpFetch)), from, to));
  }

  static handle(request: Request, deps: IngestHttpDeps = {}): Promise<Response> {
    return SahieHttp.respond(request, VaVetpop.SOURCE_NAME, VetpopHttp.run.bind(VetpopHttp), deps);
  }
}
