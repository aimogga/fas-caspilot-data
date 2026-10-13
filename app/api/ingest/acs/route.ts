import { AcsHttp } from '@/lib/ingest/acs-http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return AcsHttp.handle(request);
}
