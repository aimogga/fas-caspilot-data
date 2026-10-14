import { HrsaHpsaMh } from '../../packages/ingest/hrsa_hpsa_mh';
import { SahieHttp, type IngestHttpDeps, type SahieRunOpts } from './sahie-http';

/** n8n entry: fetch CSV → parse → fill → requireComplete → load, on the shared SahieHttp skeleton. The body `year` is ignored. */
export class HpsaHttp {
  static async run(opts: SahieRunOpts) {
    const now = opts.now ?? new Date();
    return SahieHttp.ingest(HrsaHpsaMh, opts, async () =>
      HrsaHpsaMh.requireComplete(HrsaHpsaMh.fill(HrsaHpsaMh.parse(await HrsaHpsaMh.fetch(opts.httpFetch), now))));
  }

  static handle(request: Request, deps: IngestHttpDeps = {}): Promise<Response> {
    return SahieHttp.respond(request, HrsaHpsaMh.SOURCE_NAME, HpsaHttp.run.bind(HpsaHttp), deps);
  }
}
