import { CommitHttp, intakeRoute } from '@/lib/intake/commit-http';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const POST = intakeRoute(CommitHttp, createClient);
