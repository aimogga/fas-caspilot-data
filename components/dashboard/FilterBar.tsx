import { FormField } from "@/components/layout";
import { buttonVariants } from "@/components/ui/button";
import { FilterSheet } from "@/components/dashboard/FilterSheet";
import { ALL, activeCount, quarterLabel, quarterOptions, type Filters } from "@/lib/dashboard/filters";
import type { CountyRow } from "@/lib/dashboard/query";
import { cn } from "@/lib/utils";

type Props = { filters: Filters; counties: CountyRow[]; referrals: string[]; now: Date };
const SELECT = "h-12 lg:h-11 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-base shadow-xs dark:bg-input/30";
const opt = (value: string, label: string) => <option key={value} value={value}>{label}</option>;

/** One `<form method="get">`; `k` keeps ids unique when the inline bar and the sheet copy both render. */
function FilterForm({ filters, counties, referrals, now, k }: Props & { k: string }) {
  const stacked = k === "sheet";
  const fields: [string, string, string, React.ReactNode[]][] = [
    ["period", "Quarter", filters.period, quarterOptions(now).map((q) => opt(q, quarterLabel(q)))],
    ["county", "County", filters.county, [opt(ALL, "All counties"), ...counties.map((c) => opt(c.fips, c.name))]],
    ["referral", "Referral source", filters.referral, [opt(ALL, "All referral sources"), ...referrals.map((r) => opt(r, r))]],
  ];
  return (
    <form method="get" action="/dashboard" data-slot="filter-form" className={cn("flex min-w-0 gap-3", stacked ? "flex-col" : "flex-wrap items-end")}>
      {fields.map(([name, label, value, options]) => (
        <FormField key={name} label={label} htmlFor={`${k}-${name}`}><select id={`${k}-${name}`} name={name} defaultValue={value} className={SELECT}>{options}</select></FormField>
      ))}
      <label className="flex min-h-11 items-center gap-2 text-base"><input type="hidden" name="compare" value="none" /><input type="checkbox" name="compare" value="prior" defaultChecked={filters.compare === "prior"} className="size-5 w-auto min-h-0" />Compare to prior quarter</label>
      <div className={cn("flex gap-3", stacked && "flex-col")}><button type="submit" className={buttonVariants()}>Apply</button><a href="/dashboard" className={buttonVariants({ variant: "outline" })}>Reset</a></div>
    </form>
  );
}

export function FilterBar(props: Props) {
  return (
    <>
      <div data-slot="filter-bar" className="hidden lg:block"><FilterForm {...props} k="bar" /></div>
      <div className="lg:hidden"><FilterSheet active={activeCount(props.filters, props.now)}><FilterForm {...props} k="sheet" /></FilterSheet></div>
    </>
  );
}
