import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import { limitsFromEnv, MemoryQuotaStore, type QuotaLimits, type QuotaStore } from './guard';
import type { Provider } from './providers';

/** Durable counters (F-508a2, #224): one Postgres count shared by every server instance, through `llm_reserve`
 * (service_role only). The windows come from the database clock, so instances with drifting clocks still share one
 * minute and one UTC day. Throws on any database error; the guard turns that into a skip (fail closed). */
export class SupabaseQuotaStore implements QuotaStore {
  constructor(
    private readonly db: SupabaseClient,
    private readonly limits: QuotaLimits = limitsFromEnv(),
  ) {}

  async reserve(provider: Provider): Promise<boolean> {
    const { data, error } = await this.db.rpc('llm_reserve', {
      p_provider: provider,
      p_rpm_limit: this.limits.rpm,
      p_daily_limit: this.limits.daily,
    });
    if (error) throw new Error(`llm_reserve failed: ${error.code ?? 'unknown'}`);
    return data === true;
  }
}

/** The durable store when the server has Supabase service env, else the per-instance in-memory store. */
export function defaultQuotaStore(): QuotaStore {
  const db = createServiceClient();
  return db ? new SupabaseQuotaStore(db) : new MemoryQuotaStore();
}
