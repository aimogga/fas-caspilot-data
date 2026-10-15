import { HomePage } from "@/components/staff/HomePage";

export const dynamic = "force-dynamic";
const ACTIONS = [["Enter a case", "/staff/entry"], ["Upload data", "/staff/intake"]] as const;
const LINKS = [["Evidence packets", "/staff/packets"], ["Team dashboard", "/dashboard"], ["County need map", "/need-map"]] as const;
/** Staff home: greeting, the quarter in three cards, public sources, then the things staff do most. */
export default function StaffPage() {
  return <HomePage heading="What do you need to do?" links={LINKS} actions={ACTIONS} tag="staff" />;
}
