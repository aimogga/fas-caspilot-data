"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** `Show FAS counties only` switch; off by default, on = `?fas=1`. Stays usable in every page state. */
export function FasFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const on = params.get("fas") === "1";
  function toggle(checked: boolean) {
    const next = new URLSearchParams(params.toString());
    if (checked) next.set("fas", "1");
    else next.delete("fas");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }
  return (
    <Label data-slot="fas-filter" className="mb-0 flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
      <Switch checked={on} onCheckedChange={toggle} />
      Show FAS counties only
    </Label>
  );
}
