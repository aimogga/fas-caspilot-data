import { PlacesHttp } from '@/lib/ingest/places-http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return PlacesHttp.handle(request);
}
