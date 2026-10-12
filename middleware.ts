import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { authCookieOptions, requestCookieContext } from '@/lib/auth/cookie-options';
import { canonicalizePath, hadSession, isNoroleAllowed, isPublicRoute, isRouteAllowed, matchGuardedPrefix, roleHome, signedInLoginTarget, type UserRole } from '@/lib/auth/role-guards';

function deny(request: NextRequest, from: NextResponse, pathname: string): NextResponse {
  const forbidden = new URL('/403', request.url);
  forbidden.searchParams.set('from', pathname);
  return withCookies(request, from, NextResponse.rewrite(forbidden, { status: 403 }));
}

function toLogin(request: NextRequest, from: NextResponse, pathname: string): NextResponse {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
  if (hadSession(request.cookies.getAll().map((c) => c.name))) {
    loginUrl.searchParams.set('reason', 'expired');
  }
  return withCookies(request, from, NextResponse.redirect(loginUrl));
}

export async function middleware(request: NextRequest) {
  const rawPath = request.nextUrl.pathname;
  const { response, user } = await updateSession(request);
  const canonical = canonicalizePath(rawPath);
  const userRole = (user?.app_metadata?.role as UserRole) || null;

  if (canonical === null) {
    return withCookies(request, response, new NextResponse(null, { status: 400 }));
  }

  if (canonical === '/login' && user) {
    const target = signedInLoginTarget(userRole, request.nextUrl.searchParams.get('redirect'), request.nextUrl.origin);
    return withCookies(request, response, NextResponse.redirect(new URL(target, request.url)));
  }

  if (user && roleHome(userRole) === null && !isNoroleAllowed(canonical)) {
    return deny(request, response, rawPath);
  }

  if (isPublicRoute(canonical)) {
    return response;
  }

  if (!user) {
    return toLogin(request, response, rawPath);
  }

  const home = roleHome(userRole);
  if (canonical === '/' && home) {
    return withCookies(request, response, NextResponse.redirect(new URL(home, request.url)));
  }

  const isGuarded = matchGuardedPrefix(canonical) !== null || canonical === '/';
  if (isGuarded && !isRouteAllowed(canonical, userRole)) {
    return deny(request, response, rawPath);
  }

  if (canonical !== rawPath) {
    const dest = request.nextUrl.clone();
    dest.pathname = canonical;
    return withCookies(request, response, NextResponse.rewrite(dest));
  }

  return response;
}

function withCookies(request: NextRequest, from: NextResponse, to: NextResponse): NextResponse {
  const flags = authCookieOptions(requestCookieContext(request));
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set({
      ...cookie,
      ...flags,
    });
  }
  return to;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
