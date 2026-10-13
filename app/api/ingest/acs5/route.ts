import { Acs5Http } from '@/lib/ingest/acs5-http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return Acs5Http.handle(request);
}
