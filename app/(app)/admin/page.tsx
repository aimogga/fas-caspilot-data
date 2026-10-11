import { EmptyState, PageHeader } from "@/components/layout";
import { PAGE_TITLE } from "@/lib/shell/nav";

export default function AdminPage() {
  return <><PageHeader title={PAGE_TITLE["/admin"] ?? "Admin Page"} /><EmptyState title="Accessible to admin role only." /></>;
}
