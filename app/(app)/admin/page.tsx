import { HomePage } from "@/components/staff/HomePage";

export const dynamic = "force-dynamic";
const LINKS = [["Data freshness", "/data-freshness"], ["Team dashboard", "/dashboard"], ["Board dashboard", "/board"], ["County need map", "/need-map"], ["Methodology", "/methodology"]] as const;
/** Admin home: the same quarter tiles as staff, then the places an admin checks most. */
export default function AdminPage() {
  return <HomePage eyebrow="ADMIN" title="Overview" heading="Where to look" links={LINKS} tag="admin" />;
}
