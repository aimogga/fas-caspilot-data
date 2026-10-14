import { ProPublicaHttp } from '@/lib/ingest/propublica-http';
export const dynamic = 'force-dynamic';
export async function POST(request: Request): Promise<Response> {
  return ProPublicaHttp.handle(request);
}
