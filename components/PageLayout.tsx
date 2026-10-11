import { Page } from '@/components/layout';
import { ORGANIZATION_NAME, PRODUCT_NAME } from '@/lib/branding';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function PageLayout({ title, children }: { title: string; children?: React.ReactNode }) {
  const supabase = await createClient();
  if (!supabase) {
    return (
      <Page>
        <header><p>{PRODUCT_NAME}</p></header>
        <h1>Configuration Error</h1>
        <p>Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.</p>
        <footer><p>{ORGANIZATION_NAME}</p></footer>
      </Page>
    );
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const role = user.app_metadata?.role || 'unknown';
  return (
    <Page>
      <header>
        <p>{PRODUCT_NAME}</p>
      </header>
      <h1>{title}</h1>
      <p>Role: <strong>{role}</strong></p>
      {children}
      <form action="/api/auth/signout" method="post">
        <button type="submit">Sign Out</button>
      </form>
      <footer>
        <p>{ORGANIZATION_NAME}</p>
      </footer>
    </Page>
  );
}
