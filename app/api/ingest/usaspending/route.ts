import { UsaSpendingHttp } from '@/lib/ingest/usaspending-http';
export const dynamic = 'force-dynamic';
export async function POST(request: Request): Promise<Response> {
  return UsaSpendingHttp.handle(request);
}
