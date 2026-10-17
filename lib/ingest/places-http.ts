import { CdcPlaces } from '../../packages/ingest/cdc_places';
import { SahieHttp, type IngestHttpDeps, type SahieRunOpts } from './sahie-http';

/** n8n entry: fetch → parse → fill → requireComplete → load, on the shared SahieHttp skeleton. */
export class PlacesHttp {
  /** No year filter by default: the county dataset is the current release, and its data year lags the calendar by about
   *  two years (the 2025 release holds 2023 data), so pinning `year - 1` matched no rows (#208). A requested year is validated. */
  static year(now: Date, requested?: string): string | undefined {
    return requested === undefined ? undefined : SahieHttp.year(now, requested);
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
