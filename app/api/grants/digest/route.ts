import { DigestHttp } from '@/lib/grants/digest-http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return DigestHttp.handle(request);
}
