import { EmptyState, PageHeader } from "@/components/layout";
import { PAGE_TITLE } from "@/lib/shell/nav";

export default function StaffPage() {
  return <><PageHeader title={PAGE_TITLE["/staff"] ?? "Staff Page"} /><EmptyState title="Accessible to admin and staff roles." /></>;
}
