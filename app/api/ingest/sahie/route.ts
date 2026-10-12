import { SahieHttp } from '@/lib/ingest/sahie-http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return SahieHttp.handle(request);
}
