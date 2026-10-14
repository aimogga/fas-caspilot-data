import { CdcPlaces } from '../../packages/ingest/cdc_places';
import { SahieHttp, type IngestHttpDeps, type SahieRunOpts } from './sahie-http';

/** n8n entry: fetch → parse → fill → requireComplete → load, on the shared SahieHttp skeleton. */
export class PlacesHttp {
  /** PLACES publishes the prior data year each December, so the latest release is year - 1. */
  static year(now: Date, requested?: string): string {
    if (requested !== undefined) return SahieHttp.year(now, requested);
    return String(now.getUTCFullYear() - 1);
  }

  static async run(opts: SahieRunOpts) {
    const year = PlacesHttp.year(opts.now ?? new Date(), opts.year);
    return SahieHttp.ingest(CdcPlaces, opts, async (env) =>
      CdcPlaces.requireComplete(CdcPlaces.fill(CdcPlaces.parse(await CdcPlaces.fetch(year, env, opts.httpFetch)))));
  }

  static handle(request: Request, deps: IngestHttpDeps = {}): Promise<Response> {
    return SahieHttp.respond(request, CdcPlaces.SOURCE_NAME, PlacesHttp.run.bind(PlacesHttp), deps);
  }
}
