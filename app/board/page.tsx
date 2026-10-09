import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';

export default async function BoardPage() {
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
      <h1>Board Page</h1>
      <p>This page is accessible to all roles: admin, staff, and board_viewer.</p>
      <p>Your role: <strong>{role}</strong></p>
      
      <nav style={{ margin: '30px 0' }}>
        <Link href="/" style={{ color: '#0070f3', marginRight: '20px' }}>Home</Link>
        <SignOutButton />
      </nav>
    </div>
  );
}
