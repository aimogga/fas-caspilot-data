import { SaipeHttp } from '@/lib/ingest/saipe-http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return SaipeHttp.handle(request);
}
