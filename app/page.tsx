import { PageLayout } from '@/components/PageLayout';

export default async function HomePage() {
  return <PageLayout title="CasePilot - Home">
    <p>Home page accessible to all authenticated roles.</p>
  </PageLayout>;
}
