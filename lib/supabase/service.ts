import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

/** Service-role client for server code only (never import from a client component): it bypasses RLS, so a caller may hand
 * the browser nothing but suppressed aggregates (golden rule 5). Used by the board dashboard, whose viewers cannot read FAS
 * record rows themselves. Returns null without SUPABASE_SERVICE_ROLE_KEY so pages can fall back to the user's session. */
export function createServiceClient(): SupabaseClient | null {
  if (typeof window !== 'undefined') throw new Error('createServiceClient is server-only');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}
