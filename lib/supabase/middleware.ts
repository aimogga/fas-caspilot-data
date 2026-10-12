import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { authCookieOptions, requestCookieContext, withAuthCookieOptions } from '@/lib/auth/cookie-options';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return { response, user: null };
  }
  const ctx = requestCookieContext(request);
  const supabase = createServerClient(url, key, {
    cookieOptions: authCookieOptions(ctx),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, withAuthCookieOptions(options, ctx));
        });
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return { response, user };
}
