import { randomUUID } from "node:crypto";
import { KnowledgeForm } from "@/components/knowledge/KnowledgeForm";
import { KnowledgeList } from "@/components/knowledge/KnowledgeList";
import { EmptyState, ErrorState, FormField, PageHeader, Section, Stack } from "@/components/layout";
import { buttonVariants } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/knowledge/guard";
import { loadPage } from "@/lib/knowledge/load";
import { applyFilters, CATEGORY_LABEL, type Filters, FIRST_STEPS, parseFilters, STATUS_WORDS, STATUSES } from "@/lib/knowledge/view";

export const dynamic = "force-dynamic";
const DESCRIPTION = "What the grant writer may say about FAS. Only approved entries are quoted, and every quote cites the version it used.";

function FilterForm({ f }: { f: Filters }) {
  const opts = (all: string, list: readonly string[], label: (v: string) => string) => [<option key="all" value="all">{all}</option>, ...list.map((v) => <option key={v} value={v}>{label(v)}</option>)];
  return (
    <form method="get" data-slot="filter-form" className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end">
      <FormField label="Category" htmlFor="kf-category"><select id="kf-category" name="category" defaultValue={f.category}>{opts("All categories", CATEGORIES, (c) => CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL])}</select></FormField>
      <FormField label="Status" htmlFor="kf-status"><select id="kf-status" name="status" defaultValue={f.status}>{opts("All statuses", STATUSES, (s) => STATUS_WORDS[s as keyof typeof STATUS_WORDS].label)}</select></FormField>
      <div className="flex gap-3"><button type="submit" className={buttonVariants()}>Apply</button><a href="/admin/knowledge" className={buttonVariants({ variant: "outline" })}>Reset</a></div>
    </form>
  );
}

export default async function KnowledgeAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [data, filters] = await Promise.all([loadPage(), searchParams.then(parseFilters)]);
  const shown = data ? applyFilters(data.rows, filters) : [];
  return (
    <Stack gap={8}>
      <PageHeader eyebrow="ADMIN" title="What FAS says about itself" description={DESCRIPTION} />
      {!data ? <ErrorState message="Couldn't load FAS knowledge" referenceId={randomUUID()} href="/admin/knowledge">Nothing was changed. Try again.</ErrorState> : null}
      {data && !data.rows.length ? <EmptyState title="Nothing added yet">{FIRST_STEPS}</EmptyState> : null}
      <Section title="Add an entry">
        <p className="max-w-[72ch] text-muted-foreground">Org-level facts only. Names, phone numbers, addresses, birth dates and case numbers are refused.</p>
        <div className="max-w-2xl rounded-lg border border-border bg-card p-6 shadow-sm"><KnowledgeForm /></div>
      </Section>
      {data?.rows.length ? (
        <Section title="Entries">
          <FilterForm f={filters} />
          {shown.length ? <KnowledgeList rows={shown} me={data.me} editable /> : <EmptyState title="No entries match these filters" headingLevel="h3">Choose another category or status, or reset the filters.</EmptyState>}
        </Section>
      ) : null}
    </Stack>
  );
}
