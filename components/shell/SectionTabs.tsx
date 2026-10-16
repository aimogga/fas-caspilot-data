"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { Section } from "@/lib/shell/sections";
import { cn } from "@/lib/utils";

/** DS-21: the pages of one sidebar section as plain link tabs above the page content. One row that scrolls sideways on a phone instead of wrapping. */
export function SectionTabs({ section, current }: { section: Section; current: string }) {
  const row = useRef<HTMLUListElement>(null);
  // On a phone the Data row is wider than the screen: bring the current tab into view inside the row, never by scrolling the page.
  useEffect(() => {
    const ul = row.current, here = ul?.querySelector<HTMLElement>("[aria-current=page]");
    if (ul && here) ul.scrollLeft = Math.max(0, here.offsetLeft + here.offsetWidth - ul.clientWidth);
  }, [current]);
  return (
    <nav data-slot="section-tabs" aria-label={`${section.label} pages`} className="-mt-2 mb-6 min-w-0 border-b border-border lg:mb-8">
      <ul ref={row} className="relative m-0 flex list-none gap-1 overflow-x-auto p-0">
        {section.tabs.map((tab) => {
          const here = tab.href === current;
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={here ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm no-underline transition-colors duration-(--duration-fast) ease-(--ease-out) focus-visible:-outline-offset-2 lg:min-h-10",
                  here ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
