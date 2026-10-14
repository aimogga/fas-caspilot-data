import { UtCourts } from '../../packages/ingest/ut_courts';
import { SahieHttp, type IngestHttpDeps, type SahieRunOpts } from './sahie-http';

/** n8n entry: fetch workbook → parse → fill → requireComplete → load, on the shared SahieHttp skeleton.
 *  The body `year` is ignored: every fiscal year in the workbook loads, each under its own `FYxxxx` vintage. */
export class UtCourtsHttp {
  static async run(opts: SahieRunOpts) {
    return SahieHttp.ingest(UtCourts, opts, async () =>
      UtCourts.requireComplete(UtCourts.fill(await UtCourts.parse(await UtCourts.fetch(opts.httpFetch)))));
  }

  static handle(request: Request, deps: IngestHttpDeps = {}): Promise<Response> {
    return SahieHttp.respond(request, UtCourts.SOURCE_NAME, UtCourtsHttp.run.bind(UtCourtsHttp), deps);
  }
}
