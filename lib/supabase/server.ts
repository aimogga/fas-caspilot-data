import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { authCookieOptions, withAuthCookieOptions } from '@/lib/auth/cookie-options';

export async function createClient() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return null;
  }
  const ctx = {
    forwardedProto: headerStore.get('x-forwarded-proto'),
    nodeEnv: process.env.NODE_ENV,
    vercel: process.env.VERCEL,
  };
  return createServerClient(url, key, {
    cookieOptions: authCookieOptions(ctx),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, withAuthCookieOptions(options, ctx));
          });
        } catch {
          /* Server Components cannot set cookies */
        }
      },
    },
  });
}
