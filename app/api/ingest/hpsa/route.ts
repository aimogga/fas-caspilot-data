import { HpsaHttp } from '@/lib/ingest/hpsa-http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return HpsaHttp.handle(request);
}
