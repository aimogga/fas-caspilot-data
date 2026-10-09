import { PageLayout } from '@/components/PageLayout';

export default async function AdminPage() {
  return <PageLayout title="Admin Page">
    <p>Accessible to admin role only.</p>
  </PageLayout>;
}
