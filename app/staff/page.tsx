import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';

export default async function StaffPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const role = user.app_metadata?.role;

  if (role !== 'admin' && role !== 'staff') {
    redirect('/403');
  }

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <h1>Staff Page</h1>
      <p>This page is accessible to admin and staff roles.</p>
      <p>Your role: <strong>{role}</strong></p>
      
      <nav style={{ margin: '30px 0' }}>
        <Link href="/" style={{ color: '#0070f3', marginRight: '20px' }}>Home</Link>
        <SignOutButton />
      </nav>
    </div>
  );
}
