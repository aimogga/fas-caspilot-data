import { RecomputeHttp } from '@/lib/grants/recompute-http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return RecomputeHttp.handle(request);
}
