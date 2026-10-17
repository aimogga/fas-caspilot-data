import type { SupabaseClient } from '@supabase/supabase-js';
import { NeedMapQuery, type ConfigRow } from '../need-map/query';
import { COUNTIES } from '../synthetic/generate';
import { NeedScore, type NeedIndicator, type NeedParams, type NeedWeights } from './compute';

/** Writes need_score rows for the newest approved need_score_config, from the latest public_indicator vintages. */
export class NeedScoreRecompute {
  static async run(client: SupabaseClient): Promise<{ version: string | null; scored: number }> {
    const configs = await client.from('need_score_config').select('version,weights,params,created_at,approved_by');
    if (configs.error) throw new Error(configs.error.message);
    const config = NeedMapQuery.approved((configs.data ?? []) as Array<ConfigRow & { weights: NeedWeights; params?: NeedParams | null }>);
    if (config === null) return { version: null, scored: 0 };
    const codes = Object.keys(config.weights).map(NeedScore.code);
    const indicators = await client.from('public_indicator').select('indicator_code,geo_fips,value,moe,vintage,source_id,ingest_run_id').in('indicator_code', codes);
    if (indicators.error) throw new Error(indicators.error.message);
    const fips = COUNTIES.map((c) => c.fips);
    const scored = NeedScore.compute(config.weights, (indicators.data ?? []) as NeedIndicator[], fips, config.params ?? {});
    if (scored.length === 0) throw new Error(`need score ${config.version}: no county has every input`);
    const rows = scored.map((s) => ({ version: config.version, geo_fips: s.geo_fips, score: s.score, components: s.components }));
    const up = await client.from('need_score').upsert(rows, { onConflict: 'version,geo_fips' });
    if (up.error) throw new Error(up.error.message);
    // Counties that lost an input since the last run must not keep a stale score.
    const stale = await client.from('need_score').delete().eq('version', config.version).not('geo_fips', 'in', `(${scored.map((s) => s.geo_fips).join(',')})`);
    if (stale.error) throw new Error(stale.error.message);
    return { version: config.version, scored: scored.length };
  }
}
