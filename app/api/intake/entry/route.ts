import { EntryHttp, type EntryDb } from '@/lib/intake/entry-http';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** F-302: one manually entered record. Auth mirrors `/api/intake/template`; RLS does the org scoping. */
export async function POST(request: Request): Promise<Response> {
  const client = await createClient();
  const user = client ? (await client.auth.getUser()).data.user : null;
  const meta = (user?.app_metadata ?? {}) as { role?: string; org_id?: string };
  const who = user ? { id: user.id, role: meta.role ?? '', orgId: meta.org_id ?? null } : null;
  return EntryHttp.handle(request, who, client as unknown as EntryDb | null);
}
