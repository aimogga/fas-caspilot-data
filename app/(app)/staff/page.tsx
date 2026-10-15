import Link from "next/link";
import { Cluster, PageHeader, Stack } from "@/components/layout";
import { HomeTiles } from "@/components/staff/HomeTiles";
import { buttonVariants } from "@/components/ui/button";
import { boardAsOf } from "@/lib/board/query";
import { quarterLabel } from "@/lib/dashboard/filters";
import { NOT_AVAILABLE } from "@/lib/dashboard/cards";
import { StaffHome, type StaffHomeData } from "@/lib/staff/home";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const LINKS = [["Upload data", "/staff/intake"], ["Enter data", "/staff/entry"], ["Evidence packets", "/staff/packets"], ["Team dashboard", "/dashboard"]] as const;
/** Staff home: the latest complete quarter in four tiles with sparklines, then the things staff do most. Same suppressed numbers as the dashboards. */
export default async function StaffPage() {
  const now = new Date();
  let data: StaffHomeData | null = null;
  try {
    const client = await createClient();
    data = client ? await StaffHome.load(client, now) : null;
  } catch (e) {
    console.error("[staff] load failed", { message: e instanceof Error ? e.message : "unknown" });
  }
  const asOf = data ? boardAsOf(data.metrics) : NOT_AVAILABLE, period = data?.period ?? "";
  return (
    <Stack gap={6}>
      <PageHeader eyebrow="WORKSPACE" title="Home" description={data ? `${quarterLabel(period)} · All counties · Data as of ${asOf}` : "This quarter's numbers are not available yet."} />
      <HomeTiles tiles={StaffHome.tiles(data?.metrics ?? null)} period={period} />
      <section aria-labelledby="staff-links" className="flex flex-col gap-3">
        <h2 id="staff-links" className="font-serif text-xl font-semibold">What do you need to do?</h2>
        <Cluster gap={3}>{LINKS.map(([label, href]) => <Link key={href} href={href} className={buttonVariants({ variant: "outline" })}>{label}</Link>)}</Cluster>
      </section>
    </Stack>
  );
}
