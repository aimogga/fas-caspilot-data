import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { canonicalizePath, hadSession, isNoroleAllowed, isPublicRoute, isRouteAllowed, matchGuardedPrefix, roleHome, signedInLoginTarget, type UserRole } from '@/lib/auth/role-guards';

function deny(request: NextRequest, from: NextResponse, pathname: string): NextResponse {
  const forbidden = new URL('/403', request.url);
  forbidden.searchParams.set('from', pathname);
  return withCookies(from, NextResponse.rewrite(forbidden, { status: 403 }));
}

function toLogin(request: NextRequest, pathname: string): NextResponse {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
  if (hadSession(request.cookies.getAll().map((c) => c.name))) {
    loginUrl.searchParams.set('reason', 'expired');
  }
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const rawPath = request.nextUrl.pathname;
  const { response, user } = await updateSession(request);
  const canonical = canonicalizePath(rawPath);
  const userRole = (user?.app_metadata?.role as UserRole) || null;

  if (canonical === null) {
    return withCookies(response, new NextResponse(null, { status: 400 }));
  }

  if (canonical === '/login' && user) {
    const target = signedInLoginTarget(userRole, request.nextUrl.searchParams.get('redirect'), request.nextUrl.origin);
    return withCookies(response, NextResponse.redirect(new URL(target, request.url)));
  }

  if (user && roleHome(userRole) === null && !isNoroleAllowed(canonical)) {
    return deny(request, response, rawPath);
  }

  if (isPublicRoute(canonical)) {
    return response;
  }

  if (!user) {
    return toLogin(request, rawPath);
  }

  const home = roleHome(userRole);
  if (canonical === '/' && home) {
    return withCookies(response, NextResponse.redirect(new URL(home, request.url)));
  }

  const isGuarded = matchGuardedPrefix(canonical) !== null || canonical === '/';
  if (isGuarded && !isRouteAllowed(canonical, userRole)) {
    return deny(request, response, rawPath);
  }

  if (canonical !== rawPath) {
    const dest = request.nextUrl.clone();
    dest.pathname = canonical;
    return withCookies(response, NextResponse.rewrite(dest));
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
