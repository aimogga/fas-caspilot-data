import type { SupabaseClient } from '@supabase/supabase-js';
import { COUNTIES } from '../../lib/synthetic/generate';

export type IndicatorRow = {
  indicator_code: string;
  geo_fips: string;
  period: string;
  value: number | null;
  moe: number | null;
  unit: string;
  vintage: string;
};

/** fetched_at is ingest_run.started_at; vintage is on each public_indicator row. */
export class PublicIndicatorIngest {
  static async load(
    client: SupabaseClient,
    sourceName: string,
    checksum: string,
    rows: IndicatorRow[],
  ): Promise<{ ingestRunId: string; rowsLoaded: number; sourceId: string }> {
    const geo = await client.from('geo_county').upsert(
      COUNTIES.map((c) => ({ fips: c.fips, name: c.name, state: c.state })),
      { onConflict: 'fips' },
    );
    if (geo.error) throw new Error(geo.error.message);
    const src = await client.from('source_registry').select('id').eq('name', sourceName).single();
    if (src.error || !src.data) throw new Error(`source ${sourceName} is not registered`);
    const sourceId = src.data.id as string;
    const started = await client.from('ingest_run').insert({
      source_id: sourceId, status: 'running', checksum,
    }).select('id').single();
    if (started.error || !started.data) throw new Error(started.error?.message ?? 'ingest_run insert failed');
    const ingestRunId = started.data.id as string;
    const payload = rows.map((r) => ({ ...r, source_id: sourceId, ingest_run_id: ingestRunId }));
    try {
      const up = await client.from('public_indicator').upsert(payload, {
        onConflict: 'source_id,indicator_code,geo_fips,period,vintage',
      });
      if (up.error) throw new Error(up.error.message);
      const now = new Date().toISOString();
      const fin = await client.from('ingest_run').update({
        status: 'ok', rows_loaded: rows.length, finished_at: now,
      }).eq('id', ingestRunId);
      if (fin.error) throw new Error(fin.error.message);
      await client.from('source_registry').update({ last_success_at: now }).eq('id', sourceId);
      return { ingestRunId, rowsLoaded: rows.length, sourceId };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'load failed';
      await client.from('ingest_run').update({
        status: 'error', error: message, finished_at: new Date().toISOString(),
      }).eq('id', ingestRunId);
      if (e instanceof Error) Object.assign(e, { ingestRunId });
      throw e;
    }
  }

  /** Logs a run that failed before load (fetch, parse, completeness), so every attempt has an ingest_run row. */
  static async recordFailure(client: SupabaseClient, sourceName: string, message: string): Promise<string | null> {
    const src = await client.from('source_registry').select('id').eq('name', sourceName).single();
    if (src.error || !src.data) return null;
    const now = new Date().toISOString();
    const run = await client.from('ingest_run').insert({
      source_id: src.data.id as string, status: 'error', error: message, finished_at: now,
    }).select('id').single();
    return run.error || !run.data ? null : (run.data.id as string);
  }
}
