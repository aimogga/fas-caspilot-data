import { HomePage } from "@/components/staff/HomePage";

export const dynamic = "force-dynamic";
const ACTIONS = [["Open data freshness", "/data-freshness"], ["Open team dashboard", "/dashboard"]] as const;
const LINKS = [["Board dashboard", "/board"], ["County need map", "/need-map"], ["Evidence packets", "/staff/packets"], ["Methodology", "/methodology"]] as const;
/** Admin home: the same cards as staff, then the places an admin checks most. */
export default function AdminPage() {
  return <HomePage heading="Where to look" links={LINKS} actions={ACTIONS} tag="admin" />;
}
