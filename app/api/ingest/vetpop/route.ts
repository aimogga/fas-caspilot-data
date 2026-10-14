import { VetpopHttp } from '@/lib/ingest/vetpop-http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return VetpopHttp.handle(request);
}
