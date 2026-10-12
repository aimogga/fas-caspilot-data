import { describe, expect, it } from 'vitest';
import {
  authCookieOptions,
  isSecureCookieContext,
  requestCookieContext,
  withAuthCookieOptions,
} from './cookie-options';

describe('isSecureCookieContext', () => {
  it('is false on local http', () => {
    expect(isSecureCookieContext({ url: 'http://127.0.0.1:3000' })).toBe(false);
    expect(isSecureCookieContext({ protocol: 'http:' })).toBe(false);
    expect(isSecureCookieContext({ forwardedProto: 'http' })).toBe(false);
  });

  it('is true on https including previews', () => {
    expect(isSecureCookieContext({ url: 'https://fas-preview.vercel.app' })).toBe(true);
    expect(isSecureCookieContext({ protocol: 'https:' })).toBe(true);
    expect(isSecureCookieContext({ forwardedProto: 'https' })).toBe(true);
    expect(isSecureCookieContext({ forwardedProto: 'https, http' })).toBe(true);
  });

  it('treats an explicit http proto as non-Secure even in production', () => {
    expect(isSecureCookieContext({
      nodeEnv: 'production',
      url: 'http://127.0.0.1:3000',
    })).toBe(false);
  });

  it('falls back to Vercel or production when proto is unknown', () => {
    expect(isSecureCookieContext({ nodeEnv: 'development' })).toBe(false);
    expect(isSecureCookieContext({ nodeEnv: 'production' })).toBe(true);
    expect(isSecureCookieContext({ vercel: '1' })).toBe(true);
    expect(isSecureCookieContext({ vercel: '1', forwardedProto: 'http' })).toBe(false);
  });
});

describe('authCookieOptions', () => {
  it('always sets HttpOnly, SameSite=Lax, and path=/', () => {
    const http = authCookieOptions({ url: 'http://localhost:3000' });
    expect(http.httpOnly).toBe(true);
    expect(http.sameSite).toBe('lax');
    expect(http.path).toBe('/');
    expect(http.secure).toBe(false);
    const https = authCookieOptions({ url: 'https://example.test' });
    expect(https.httpOnly).toBe(true);
    expect(https.sameSite).toBe('lax');
    expect(https.secure).toBe(true);
  });

  it('overlays flags onto existing cookie options', () => {
    const merged = withAuthCookieOptions(
      { httpOnly: false, secure: false, sameSite: 'none' as const, maxAge: 60, path: '/old' },
      { url: 'https://example.test' },
    );
    expect(merged.httpOnly).toBe(true);
    expect(merged.secure).toBe(true);
    expect(merged.sameSite).toBe('lax');
    expect(merged.path).toBe('/');
    expect(merged.maxAge).toBe(60);
  });

  it('reads proto from a request-like object', () => {
    const ctx = requestCookieContext({
      url: 'http://127.0.0.1:3000/login',
      headers: { get: (name) => (name === 'x-forwarded-proto' ? 'https' : null) },
    });
    expect(isSecureCookieContext(ctx)).toBe(true);
  });
});
