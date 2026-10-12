import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { hadSession, isPublicRoute, isRouteAllowed, matchGuardedPrefix, roleHome, signedInLoginTarget, type UserRole } from '@/lib/auth/role-guards';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const { response, user } = await updateSession(request);

  if (pathname === '/login' && user) {
    const role = (user.app_metadata?.role as UserRole) || null;
    const target = signedInLoginTarget(role, request.nextUrl.searchParams.get('redirect'), request.nextUrl.origin);
    return withCookies(response, NextResponse.redirect(new URL(target, request.url)));
  }

  if (isPublicRoute(pathname)) {
    return response;
  }

  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
    if (hadSession(request.cookies.getAll().map((c) => c.name))) {
      loginUrl.searchParams.set('reason', 'expired');
    }
    return NextResponse.redirect(loginUrl);
  }

  const userRole = (user.app_metadata?.role as UserRole) || null;
  const home = roleHome(userRole);

  if (pathname === '/' && home) {
    return withCookies(response, NextResponse.redirect(new URL(home, request.url)));
  }

  const isGuarded = matchGuardedPrefix(pathname) !== null || pathname === '/';
  if (isGuarded && !isRouteAllowed(pathname, userRole)) {
    const forbidden = new URL('/403', request.url);
    forbidden.searchParams.set('from', pathname);
    return withCookies(response, NextResponse.rewrite(forbidden, { status: 403 }));
  }

  return response;
}

function withCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
