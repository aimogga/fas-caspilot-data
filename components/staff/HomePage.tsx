import Link from "next/link";
import { Grid, PageHeader, Stack } from "@/components/layout";
import { HomeTiles } from "@/components/staff/HomeTiles";
import { FreshnessChip } from "@/components/trust";
import { Hint } from "@/components/trust/explain";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NOT_AVAILABLE } from "@/lib/dashboard/cards";
import { latestCompleteQuarter } from "@/lib/dashboard/filters";
import type { FreshnessPageView } from "@/lib/freshness/query";
import { dateEyebrow, firstName, greeting, StaffHome, summary, type StaffHomeData } from "@/lib/staff/home";
import { createClient } from "@/lib/supabase/server";
import { GLOSSARY } from "@/lib/trust/glossary";
import { cn } from "@/lib/utils";

export type HomeLinks = readonly (readonly [label: string, href: string])[];
type Props = { heading: string; links: HomeLinks; actions: readonly [secondary: readonly [string, string], primary: readonly [string, string]]; tag: "staff" | "admin" };
const H2 = "text-xl font-semibold", FOOT = "text-xs font-medium tracking-wide text-muted-foreground";

/** Up to five public sources, worst first, each with its status in words; the whole list sits behind "Open data freshness". */
function PublicSources({ view }: { view: FreshnessPageView | null }) {
  return (
    <section aria-labelledby="home-sources" data-slot="public-sources"><Card className="h-full">
      <CardHeader><CardTitle><h2 id="home-sources" className={H2}>Public sources</h2></CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!view ? <p className="font-medium">{NOT_AVAILABLE}</p> : view.rows.length === 0 ? <p className="text-sm text-muted-foreground">No sources registered yet</p> : (
          <ul className="divide-y">
            {view.rows.slice(0, 5).map((r) => (
              <li key={r.name} data-status={r.status} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground">Latest {r.latestVintage}</span>
                <span className="ml-auto">{r.status === "not_published"
                  ? <Hint text={GLOSSARY.not_published.plain} className="rounded-full"><Badge variant="muted" className="border-dashed border-border" prefix={<span aria-hidden>○</span>}>Not published</Badge></Hint>
                  : <FreshnessChip status={r.status} />}</span>
              </li>
            ))}
          </ul>
        )}
        {view ? <p data-slot="source-footer" className={FOOT}>Source registry · {view.asOf ? `as of ${view.asOf}` : "date not available yet"}</p> : null}
        <Link href="/data-freshness" className={cn(buttonVariants({ variant: "outline" }), "self-start")}>Open data freshness</Link>
      </CardContent>
    </Card></section>
  );
}

/** A role's home (DS-10a): dated eyebrow, greeting, one sentence about the quarter, three KPI cards, then public sources beside that role's quick links. */
export async function HomePage({ heading, links, actions, tag }: Props) {
  const now = new Date();
  let data: StaffHomeData | null = null, name: string | null = null;
  try {
    const client = await createClient();
    if (client) {
      const user = (await client.auth.getUser()).data.user;
      name = firstName(user?.user_metadata);
      data = await StaffHome.load(client, now, typeof user?.app_metadata?.role === "string" ? user.app_metadata.role : null);
    }
  } catch (e) {
    console.error(`[${tag}] load failed`, { message: e instanceof Error ? e.message : "unknown" });
  }
  const [[secondaryLabel, secondaryHref], [primaryLabel, primaryHref]] = actions, period = data?.period ?? latestCompleteQuarter(now), id = `${tag}-links`;
  return (
    <Stack gap={8}>
      <Stack gap={3}>
        <PageHeader eyebrow={dateEyebrow(now)} title={greeting(now, name)} actions={<>
          <Link href={secondaryHref} className={buttonVariants({ variant: "outline" })}>{secondaryLabel}</Link>
          <Link href={primaryHref} className={buttonVariants()}>{primaryLabel}</Link>
        </>} />
        <p data-slot="home-summary" className="max-w-prose font-serif text-xl leading-snug lg:text-2xl">{summary(data?.metrics ?? null)}</p>
      </Stack>
      <HomeTiles cards={StaffHome.cards(data?.metrics ?? null, period)} period={period} href={`/${tag}`} />
      <Grid cols={2}>
        <PublicSources view={data?.freshness ?? null} />
        <section aria-labelledby={id}><Card className="h-full">
          <CardHeader><CardTitle><h2 id={id} className={H2}>{heading}</h2></CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3">{links.map(([label, href]) => <Link key={href} href={href} className={buttonVariants({ variant: "outline" })}>{label}</Link>)}</CardContent>
        </Card></section>
      </Grid>
    </Stack>
  );
}
