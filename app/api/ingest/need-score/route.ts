import { NeedScoreHttp } from '@/lib/ingest/need-score-http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return NeedScoreHttp.handle(request);
}
