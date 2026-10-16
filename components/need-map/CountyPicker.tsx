"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PICKER_LABEL, PICKER_PLACEHOLDER, type PickerOption } from "@/lib/need-map/picker";

const SELECT = "h-11 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-base shadow-xs focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 dark:bg-input/30 lg:text-sm";

/** The same choice as a map click (DS-22): a native select that sets `?county=` and keeps `fas`; the placeholder clears it. */
export function CountyPicker({ options, selected }: { options: PickerOption[]; selected: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  function choose(fips: string) {
    const next = new URLSearchParams(params.toString());
    if (fips) next.set("county", fips);
    else next.delete("county");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }
  return (
    <div data-slot="county-picker" className="mb-2 grid gap-1">
      <label htmlFor="county-picker" className="text-sm font-medium">{PICKER_LABEL}</label>
      <select id="county-picker" value={selected ?? ""} onChange={(e) => choose(e.target.value)} className={SELECT}>
        <option value="">{PICKER_PLACEHOLDER}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
