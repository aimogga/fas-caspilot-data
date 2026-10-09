'use client';
import { useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const redirect = useSearchParams().get('redirect') || '/';
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await createClient().auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else { router.push(redirect); router.refresh(); }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px' }}>
      <h1>Sign In</h1>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
        </div>
        {error && <div style={{ color: 'red', marginBottom: '16px' }}>{error}</div>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', backgroundColor: loading ? '#ccc' : '#0070f3', color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<div>Loading...</div>}><LoginForm /></Suspense>;
}
