import { EmptyState, PageHeader } from "@/components/layout";

export default function AdminPage() {
  return <><PageHeader title="Admin Page" /><EmptyState title="Accessible to admin role only." /></>;
}
