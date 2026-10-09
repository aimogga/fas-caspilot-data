import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function PageLayout({ title, children }: { title: string; children?: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const role = user.app_metadata?.role || 'unknown';
  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <h1>{title}</h1>
      <p>Role: <strong>{role}</strong></p>
      {children}
      <form action="/api/auth/signout" method="post" style={{ marginTop: '20px' }}>
        <button type="submit">Sign Out</button>
      </form>
    </div>
  );
}
