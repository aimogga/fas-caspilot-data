import { CircleAlert, CircleCheck, Inbox, Info, TriangleAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { Cluster, EmptyState, ErrorState, FormField, Grid, Page, PageHeader, ResponsiveTable, Section, Skeleton, Stack } from "@/components/layout";
import { DraftBanner, FreshnessChip, NotPublished, SourceFooter, SuppressedCell } from "@/components/trust";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { isDevGalleryEnabled } from "@/lib/dev-gallery";

const VARIANTS = ["default", "secondary", "outline", "ghost", "destructive", "link"] as const;
const ALERTS = [["destructive", CircleAlert, "Upload failed"], ["warning", TriangleAlert, "Deadline soon"], ["info", Info, "New grant match"]] as const;
const cols = ["County", "Families", "Sessions", "Status", "Action"] as const;

export default function UiGalleryPage() {
  if (!isDevGalleryEnabled()) notFound();
  return (
    <Page className="flex flex-col gap-4">
      <PageHeader eyebrow="Dev" title="Component gallery" description="Layout and trust primitives." actions={<Button>Export packet</Button>} />
      <section className="flex flex-wrap gap-2" aria-label="Buttons">
        {VARIANTS.map((v) => <Button key={v} variant={v}>{v}</Button>)}
        {(["sm", "default", "lg"] as const).map((s) => <Button key={s} size={s}>{s}</Button>)}
        <Button size="icon" aria-label="Add">+</Button>
        <Button loading>Save draft</Button>
        <Button disabled>Disabled</Button>
      </section>
      <Separator />
      <FormField label="Email" htmlFor="gallery-email"><Input id="gallery-email" type="email" defaultValue="staff@example.test" /></FormField>
      <Label htmlFor="gallery-disabled">Disabled field</Label>
      <Input id="gallery-disabled" disabled defaultValue="disabled@example.test" />
      <Label htmlFor="gallery-err">County</Label>
      <Input id="gallery-err" aria-invalid="true" aria-describedby="gallery-err-msg" />
        <p id="gallery-err-msg" className="flex items-center gap-1 text-destructive"><CircleAlert className="size-4" aria-hidden />Enter a Utah county.</p>
      <section className="flex flex-wrap gap-2" aria-label="Badges">
        <Badge variant="success" prefix={<CircleCheck />}>success</Badge>
        <Badge variant="warning" prefix={<TriangleAlert />}>warning</Badge>
        <Badge variant="destructive" prefix={<CircleAlert />}>destructive</Badge>
        <Badge variant="info" prefix={<Info />}>info</Badge>
        <Badge variant="muted" prefix="n&lt;11">muted</Badge>
      </section>
      {ALERTS.map(([v, Icon, title]) => <Alert key={v} variant={v}><Icon /><AlertTitle>{title}</AlertTitle><AlertDescription>{v} status.</AlertDescription></Alert>)}
      <Card><CardHeader><CardTitle>Card</CardTitle></CardHeader><CardContent>Every variant is on this page.</CardContent></Card>
      <Section title="Layout">
        <Stack gap={3}><p>Stack</p><Skeleton className="h-8 w-full" /></Stack>
        <Cluster gap={2}><Badge variant="info" prefix={<Info />}>wraps</Badge><Badge variant="muted" prefix="n&lt;11">min-width 0</Badge></Cluster>
        <Grid cols={4}>{["A", "B", "C", "D"].map((t) => <Card key={t}><CardHeader><CardTitle>{t}</CardTitle></CardHeader></Card>)}</Grid>
        <EmptyState icon={<Inbox />} title="No uploads yet" action={<Button>Upload a file</Button>}>Upload your first case file.</EmptyState>
        <ErrorState message="Ingest failed." referenceId="run_demo" />
        <ResponsiveTable stack>
          <thead><tr><th>County</th><th>n</th><th>Open</th></tr></thead>
          <tbody><tr><td>Utah</td><td>24</td><td><button type="button">Open</button></td></tr></tbody>
        </ResponsiveTable>
        <Card>
          <ResponsiveTable>
            <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody><tr><td>Utah</td><td>24</td><td>120</td><td>Current</td><td><button type="button">View</button></td></tr></tbody>
          </ResponsiveTable>
        </Card>
      </Section>
      <Section title="Trust">
        <SourceFooter source="ACS S0101" period="2024" n={42} asOf="2024-06" />
        <p>Suppressed <SuppressedCell count={7} /></p>
        <Cluster gap={2}><FreshnessChip status="current" /><FreshnessChip status="stale" /><FreshnessChip status="failed" /></Cluster>
        <NotPublished />
        <DraftBanner />
      </Section>
    </Page>
  );
}
