import { FoundationHttp } from '@/lib/grants/foundation-http';
import { createClient } from '@/lib/supabase/server';

export const POST = async (request: Request): Promise<Response> => FoundationHttp.post(request, await createClient());
