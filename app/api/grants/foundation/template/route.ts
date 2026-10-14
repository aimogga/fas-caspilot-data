import { FoundationHttp } from '@/lib/grants/foundation-http';
import { createClient } from '@/lib/supabase/server';

export const GET = async (): Promise<Response> => FoundationHttp.auth(await createClient()).then((a) => (a instanceof Response ? a : FoundationHttp.template()));
