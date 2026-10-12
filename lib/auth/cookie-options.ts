export type CookieContext = {
  url?: string | null;
  protocol?: string | null;
  forwardedProto?: string | null;
  nodeEnv?: string | null;
  vercel?: string | null;
};

export type AuthCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
};

function protocolOf(input: CookieContext): string | null {
  if (input.forwardedProto) {
    return input.forwardedProto.split(',')[0]?.trim().toLowerCase() ?? null;
  }
  if (input.protocol) {
    return input.protocol.replace(/:$/, '').toLowerCase();
  }
  if (input.url) {
    try {
      return new URL(input.url).protocol.replace(/:$/, '').toLowerCase();
    } catch {
      return null;
    }
  }
  return null;
}

export function envCookieContext(): CookieContext {
  return {
    nodeEnv: process.env.NODE_ENV,
    vercel: process.env.VERCEL,
  };
}

export function requestCookieContext(request: {
  url: string;
  headers: { get(name: string): string | null };
}): CookieContext {
  return {
    url: request.url,
    forwardedProto: request.headers.get('x-forwarded-proto'),
    nodeEnv: process.env.NODE_ENV,
    vercel: process.env.VERCEL,
  };
}

/** Secure on https (including Vercel previews). Local http stays non-Secure. */
export function isSecureCookieContext(input: CookieContext = envCookieContext()): boolean {
  const proto = protocolOf(input);
  if (proto === 'http') {
    return false;
  }
  if (proto === 'https') {
    return true;
  }
  if (input.vercel) {
    return true;
  }
  return input.nodeEnv === 'production';
}

export function authCookieOptions(input: CookieContext = envCookieContext()): AuthCookieOptions {
  return {
    httpOnly: true,
    secure: isSecureCookieContext(input),
    sameSite: 'lax',
    path: '/',
  };
}

export function withAuthCookieOptions<T extends object>(
  options: T | undefined,
  input: CookieContext = envCookieContext(),
): Omit<T, keyof AuthCookieOptions> & AuthCookieOptions {
  return {
    ...(options ?? ({} as T)),
    ...authCookieOptions(input),
  };
}
