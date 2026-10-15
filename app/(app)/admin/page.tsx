import Link from "next/link";
import { Cluster, PageHeader, Stack } from "@/components/layout";
import { HomeTiles } from "@/components/staff/HomeTiles";
import { buttonVariants } from "@/components/ui/button";
import { boardAsOf } from "@/lib/board/query";
import { NOT_AVAILABLE } from "@/lib/dashboard/cards";
import { quarterLabel } from "@/lib/dashboard/filters";
import { StaffHome, type StaffHomeData } from "@/lib/staff/home";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const LINKS = [["Data freshness", "/data-freshness"], ["Team dashboard", "/dashboard"], ["Board dashboard", "/board"], ["County need map", "/need-map"], ["Methodology", "/methodology"]] as const;
/** Admin home: the same four quarter tiles as staff, then the places an admin checks most. Same suppressed numbers as every dashboard. */
export default async function AdminPage() {
  const now = new Date();
  let data: StaffHomeData | null = null;
  try {
    const client = await createClient();
    data = client ? await StaffHome.load(client, now) : null;
  } catch (e) {
    console.error("[admin] load failed", { message: e instanceof Error ? e.message : "unknown" });
  }
  const asOf = data ? boardAsOf(data.metrics) : NOT_AVAILABLE, period = data?.period ?? "";
  return (
    <Stack gap={6}>
      <PageHeader eyebrow="ADMIN" title="Overview" description={data ? `${quarterLabel(period)} · All counties · Data as of ${asOf}` : "This quarter's numbers are not available yet."} />
      <HomeTiles tiles={StaffHome.tiles(data?.metrics ?? null)} period={period} />
      <section aria-labelledby="admin-links" className="flex flex-col gap-3">
        <h2 id="admin-links" className="font-serif text-xl font-semibold">Where to look</h2>
        <Cluster gap={3}>{LINKS.map(([label, href]) => <Link key={href} href={href} className={buttonVariants({ variant: "outline" })}>{label}</Link>)}</Cluster>
      </section>
    </Stack>
  );
}
