import { TemplateHttp } from '@/lib/intake/template-http';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const client = await createClient();
  const user = client ? (await client.auth.getUser()).data.user : null;
  return TemplateHttp.handle(request, user ? ((user.app_metadata?.role as string | undefined) ?? '') : null);
}
