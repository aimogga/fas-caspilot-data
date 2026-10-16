'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Page, FormField, Skeleton } from '@/components/layout';
import { ExplainCard, Hint } from '@/components/trust/explain';
import { Wordmark } from '@/components/shell/ShellFrame';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ORGANIZATION_NAME, PRODUCT_NAME } from '@/lib/branding';
import { createClient } from '@/lib/supabase/client';
import { safeRedirect } from '@/lib/auth/role-guards';
import { mapLoginError, UNAVAILABLE_ERROR, type LoginError } from '@/lib/auth/login-errors';
import { syntheticBadgeVisible } from '@/lib/shell/nav';

/** The one number on the page is an example; its card says so and still carries source, period, n and as of (D-040). */
const EXAMPLE = { id: 'example', title: 'Example figure', plain: 'A made-up number that shows how every figure in FAS Evidence carries its source, period, count and date. Nothing here comes from a family record.' };
const EXAMPLE_ROWS: [string, string][] = [['Period', 'Q3 2026'], ['n', '64']];
const EXAMPLE_HINT = 'An example of how a number looks once you sign in. It is not a real figure.';
const PREVIEW_HINT = 'This preview runs on made-up records. No real family data is here.';
const CHIP = 'rounded-full bg-muted px-2 text-xs leading-4 text-muted-foreground';

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
  const params = useSearchParams();
  const rawRedirect = params.get('redirect');
  const expired = params.get('reason') === 'expired';
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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: true; error?: LoginError } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? mapLoginError(null));
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
          {expired && !error ? (
            <Alert variant="info" data-reason="expired">
              <AlertTitle>Your session has ended.</AlertTitle>
              <AlertDescription>Sign in again to continue.</AlertDescription>
            </Alert>
          ) : null}
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
          {synthetic ? <Hint text={PREVIEW_HINT} className="self-start"><span data-slot="env-badge">Synthetic data · preview</span></Hint> : null}
          <p data-slot="login-eyebrow" id="login-panel-title">Public data to proof</p>
          <p data-slot="login-quote">Public data shows where families struggle. Your records show what happens next.</p>
          <div data-slot="login-example" className="hidden max-w-xs flex-col gap-2 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm lg:flex">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-muted-foreground">Days from court order to first session</p>
              <Hint text={EXAMPLE_HINT}><span data-slot="login-sample-chip" className={CHIP}>Example</span></Hint>
            </div>
            <p className="text-sm text-muted-foreground"><strong className="text-4xl font-semibold tabular-nums text-foreground">23</strong> days, median</p>
            <p data-slot="login-sample-footer" className="text-xs font-medium tracking-wide text-muted-foreground">
              <ExplainCard term={EXAMPLE} value="23 days" source="FAS records (example)" asOf="Sep 2026" rows={EXAMPLE_ROWS}>FAS records · Q3 2026 · n 64 · synthetic</ExplainCard>
            </p>
          </div>
          <p data-slot="login-note">Protected data. County-level only; counts under 11 are hidden. Every sign-in is logged.</p>
        </section>
      </div>
    </Page>
  );
}
