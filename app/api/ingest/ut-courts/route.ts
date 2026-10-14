import { UtCourtsHttp } from '@/lib/ingest/ut-courts-http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return UtCourtsHttp.handle(request);
}
