'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Page, FormField, Skeleton } from '@/components/layout';
import { Wordmark } from '@/components/shell/ShellFrame';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ORGANIZATION_NAME, PRODUCT_NAME } from '@/lib/branding';
import { createClient } from '@/lib/supabase/client';
import { safeRedirect } from '@/lib/auth/role-guards';
import { mapLoginError, UNAVAILABLE_ERROR, type LoginError } from '@/lib/auth/login-errors';
import { syntheticBadgeVisible } from '@/lib/shell/nav';

function Brand() {
  return (
    <div data-slot="login-brand">
      <Wordmark />
      <p data-slot="org">{ORGANIZATION_NAME}</p>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [loading, setLoading] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const rawRedirect = useSearchParams().get('redirect');
  const client = createClient();
  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    setError(null);
    setLoading(true);
    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        setError(mapLoginError(error));
      } else {
        router.push(safeRedirect(rawRedirect, window.location.origin));
        router.refresh();
      }
    } catch {
      setError(mapLoginError(null));
    } finally {
      setLoading(false);
    }
  }
  return (
    <div data-slot="login-card">
      <Brand />
      <h1>Sign in to {PRODUCT_NAME}</h1>
      <p data-slot="login-subtitle">Use the email your administrator invited.</p>
      {!client ? (
        <Alert variant="destructive">
          <AlertTitle>{UNAVAILABLE_ERROR}</AlertTitle>
          <AlertDescription>Try again in a few minutes.</AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={handleLogin} data-slot="login-form">
          {error ? (
            <Alert variant="destructive" ref={alertRef} tabIndex={-1}>
              <AlertTitle>{error.title}</AlertTitle>
              <AlertDescription>{error.hint}</AlertDescription>
            </Alert>
          ) : null}
          <FormField label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" placeholder="director@example.org" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </FormField>
          <FormField label="Password" htmlFor="password">
            <div data-slot="password-row">
              <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" data-slot="password-toggle" aria-pressed={showPassword} aria-controls="password" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? 'Hide' : 'Show'}
                <span className="sr-only"> password</span>
              </button>
            </div>
          </FormField>
          <Button type="submit" size="lg" data-slot="login-submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
          <p data-slot="login-help">New board member? Use the link in your invitation email to set a password.</p>
        </form>
      )}
    </div>
  );
}

function LoginSkeleton() {
  return (
    <div data-slot="login-card" aria-busy="true">
      <Brand />
      <h1>Sign in to {PRODUCT_NAME}</h1>
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
    </div>
  );
}

export default function LoginPage() {
  const synthetic = syntheticBadgeVisible(process.env.NEXT_PUBLIC_ENV);
  return (
    <Page>
      <div data-slot="login">
        <div data-slot="login-main">
          <Suspense fallback={<LoginSkeleton />}>
            <LoginForm />
          </Suspense>
        </div>
        <section data-slot="login-panel" aria-labelledby="login-panel-title">
          {synthetic ? <span data-slot="env-badge">Synthetic data · preview</span> : null}
          <p data-slot="login-eyebrow" id="login-panel-title">Public data to proof</p>
          <p data-slot="login-quote">Public data shows where families struggle. Your records show what happens next.</p>
          <div data-slot="login-sample" aria-hidden="true">
            <div data-slot="login-sample-head">
              <p>Days from court order to first session</p>
              <span data-slot="login-sample-chip">Example</span>
            </div>
            <p><strong>23</strong> days median</p>
            <p>FAS records · Q3 2026 · n = 64 · synthetic</p>
          </div>
          <p data-slot="login-note">Protected data. County-level only; counts under 11 are hidden. Every sign-in is logged.</p>
        </section>
      </div>
    </Page>
  );
}
