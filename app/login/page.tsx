'use client';
import { useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { safeRedirect } from '@/lib/auth/role-guards';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const redirect = safeRedirect(useSearchParams().get('redirect'));
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
      else { router.push(redirect); router.refresh(); }
    } catch { setError('An unexpected error occurred'); }
    finally { setLoading(false); }
  }
  return (
    <form onSubmit={handleLogin}>
      <h1>Sign In</h1>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label htmlFor="password">Password</label>
      <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p>{error}</p>}
      <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
    </form>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<p>Loading...</p>}><LoginForm /></Suspense>;
}
