import { SamRegistration } from '@/lib/ingest/sam-registration-http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return SamRegistration.handle(request);
}
