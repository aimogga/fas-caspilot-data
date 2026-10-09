import { PageLayout } from '@/components/PageLayout';

export default async function BoardPage() {
  return <PageLayout title="Board Page">
    <p>Accessible to all roles: admin, staff, and board_viewer.</p>
  </PageLayout>;
}
