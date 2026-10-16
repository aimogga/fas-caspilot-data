import { canonicalizePath } from "@/lib/auth/role-guards";

/** DS-21: a sidebar link names a task; the pages that serve it become tabs. Every tab is the existing route, so no URL, guard or bookmark changes. */
export type SectionTab = { label: string; href: string };
export type Section = { label: string; tabs: SectionTab[] };

export const SECTIONS: readonly Section[] = [
  { label: "Insights", tabs: [{ label: "Team dashboard", href: "/dashboard" }, { label: "County need map", href: "/need-map" }] },
  {
    label: "Data",
    tabs: [
      { label: "Upload", href: "/staff/intake" },
      { label: "Enter by hand", href: "/staff/entry" },
      { label: "Freshness", href: "/data-freshness" },
      { label: "Methodology", href: "/methodology" },
    ],
  },
  { label: "Grants", tabs: [{ label: "Foundation grants", href: "/staff/grants" }, { label: "Matches", href: "/staff/grants/matches" }] },
];

/** Board viewers keep their short direct list (Board dashboard, County need map, Methodology): /dashboard and the staff pages would 403 for them. */
const TABBED_ROLES = new Set(["staff", "admin"]);

export function sectionsForRole(role: string): readonly Section[] {
  return TABBED_ROLES.has(role) ? SECTIONS : [];
}

/** The section and tab the current page belongs to for this role, or null (Home, Evidence packets, Board, Admin, or a board viewer anywhere). */
export function sectionFor(pathname: string, role: string): { section: Section; tab: SectionTab } | null {
  const path = canonicalizePath(pathname);
  if (path === null) return null;
  for (const section of sectionsForRole(role)) {
    const tab = section.tabs.find((t) => t.href === path);
    if (tab) return { section, tab };
  }
  return null;
}
