import { AwardAbstracts } from '@/lib/grants/award-abstract';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return AwardAbstracts.handle(request);
}
