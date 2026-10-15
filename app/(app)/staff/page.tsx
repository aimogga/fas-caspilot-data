import { HomePage } from "@/components/staff/HomePage";

export const dynamic = "force-dynamic";
const LINKS = [["Upload data", "/staff/intake"], ["Enter data", "/staff/entry"], ["Evidence packets", "/staff/packets"], ["Team dashboard", "/dashboard"]] as const;
/** Staff home: the quarter tiles, then the things staff do most. */
export default function StaffPage() {
  return <HomePage eyebrow="WORKSPACE" title="Home" heading="What do you need to do?" links={LINKS} tag="staff" />;
}
