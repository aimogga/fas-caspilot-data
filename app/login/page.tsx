'use client';
import { useState, Suspense } from 'react';
import { ORGANIZATION_NAME, PRODUCT_NAME } from '@/lib/branding';
import { createClient } from '@/lib/supabase/client';
import { safeRedirect } from '@/lib/auth/role-guards';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const rawRedirect = useSearchParams().get('redirect');
  const client = createClient();
  if (!client) {
    return <p>Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.</p>;
  }
  const supabase = client;
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else { router.push(safeRedirect(rawRedirect, window.location.origin)); router.refresh(); }
    } catch { setError('An unexpected error occurred'); }
    finally { setLoading(false); }
  }
  return (
    <main>
      <header>
        <h1>{PRODUCT_NAME}</h1>
        <p>{ORGANIZATION_NAME}</p>
      </header>
      <form onSubmit={handleLogin}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p>{error}</p>}
        <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<p>Loading...</p>}><LoginForm /></Suspense>;
}
