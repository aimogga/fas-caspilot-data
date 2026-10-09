import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const role = user.app_metadata?.role || 'unknown';

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <h1>CasePilot - Home</h1>
      <p>Welcome, {user.email}</p>
      <p>Your role: <strong>{role}</strong></p>
      
      <nav style={{ margin: '30px 0' }}>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: '10px' }}>
            <Link href="/" style={{ color: '#0070f3' }}>Home</Link>
          </li>
          {(role === 'admin' || role === 'staff') && (
            <li style={{ marginBottom: '10px' }}>
              <Link href="/staff" style={{ color: '#0070f3' }}>Staff Page</Link>
            </li>
          )}
          {role === 'admin' && (
            <li style={{ marginBottom: '10px' }}>
              <Link href="/admin" style={{ color: '#0070f3' }}>Admin Page</Link>
            </li>
          )}
          <li style={{ marginBottom: '10px' }}>
            <Link href="/board" style={{ color: '#0070f3' }}>Board Page</Link>
          </li>
        </ul>
      </nav>

      <SignOutButton />
    </div>
  );
}
