import { EmptyState, PageHeader } from "@/components/layout";
import { PAGE_TITLE } from "@/lib/shell/nav";

export default function BoardPage() {
  return <><PageHeader title={PAGE_TITLE["/board"] ?? "Board Page"} /><EmptyState title="Accessible to all roles: admin, staff, and board_viewer." /></>;
}
