import Link from "next/link";
import { Cluster, PageHeader, Stack } from "@/components/layout";
import { HomeTiles } from "@/components/staff/HomeTiles";
import { buttonVariants } from "@/components/ui/button";
import { boardAsOf } from "@/lib/board/query";
import { NOT_AVAILABLE } from "@/lib/dashboard/cards";
import { quarterLabel } from "@/lib/dashboard/filters";
import { StaffHome, type StaffHomeData } from "@/lib/staff/home";
import { createClient } from "@/lib/supabase/server";

export type HomeLinks = readonly (readonly [label: string, href: string])[];
/** A role's home: the latest complete quarter in four tiles with sparklines, then that role's quick links. Staff and admin share it; same suppressed numbers as the dashboards. */
export async function HomePage({ eyebrow, title, heading, links, tag }: { eyebrow: string; title: string; heading: string; links: HomeLinks; tag: string }) {
  const now = new Date();
  let data: StaffHomeData | null = null;
  try {
    const client = await createClient();
    data = client ? await StaffHome.load(client, now) : null;
  } catch (e) {
    console.error(`[${tag}] load failed`, { message: e instanceof Error ? e.message : "unknown" });
  }
  const asOf = data ? boardAsOf(data.metrics) : NOT_AVAILABLE, period = data?.period ?? "", id = `${tag}-links`;
  return (
    <Stack gap={6}>
      <PageHeader eyebrow={eyebrow} title={title} description={data ? `${quarterLabel(period)} · All counties · Data as of ${asOf}` : "This quarter's numbers are not available yet."} />
      <HomeTiles tiles={StaffHome.tiles(data?.metrics ?? null)} period={period} />
      <section aria-labelledby={id} className="flex flex-col gap-3">
        <h2 id={id} className="font-serif text-xl font-semibold">{heading}</h2>
        <Cluster gap={3}>{links.map(([label, href]) => <Link key={href} href={href} className={buttonVariants({ variant: "outline" })}>{label}</Link>)}</Cluster>
      </section>
    </Stack>
  );
}
