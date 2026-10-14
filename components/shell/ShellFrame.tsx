"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, House, LayoutDashboard, Menu, Shield, type LucideIcon } from "lucide-react";
import { AggregateFreshnessChip } from "@/components/freshness/AggregateFreshnessChip";
import { Page } from "@/components/layout";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ORGANIZATION_NAME, PRODUCT_NAME } from "@/lib/branding";
import { crumbFor, navForRole, PREVIEW_FOOTER, type NavGroup } from "@/lib/shell/nav";

const ICONS: Record<string, LucideIcon> = { "/staff": House, "/admin": Shield, "/board": LayoutDashboard, "/methodology": BookOpen };

export function Wordmark() {
  return (
    <div data-slot="wordmark">
      <span className="sr-only">{PRODUCT_NAME}</span>
      <span data-slot="fas" aria-hidden>FAS</span>
      <span data-slot="rule" data-rail="hide" aria-hidden />
      <span data-slot="evidence" data-rail="hide" aria-hidden>EVIDENCE</span>
    </div>
  );
}

function NavLinks({ groups, pathname, onNavigate }: { groups: NavGroup[]; pathname: string; onNavigate?: () => void }) {
  return groups.map((group) => (
    <div key={group.label} data-slot="nav-group">
      <p data-rail="hide">{group.label}</p>
      {group.items.map((item) => {
        const Icon = ICONS[item.href] ?? House;
        return (
          <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} aria-label={item.label} onClick={onNavigate}>
            <Icon aria-hidden /><span data-rail="hide">{item.label}</span>
          </Link>
        );
      })}
    </div>
  ));
}

export function ShellFrame({ role, roleLabel, name, showSynthetic, children }: { role: string; roleLabel: string; name: string; showSynthetic: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const { groups, footer } = navForRole(role);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const closeSheet = () => {
    setOpen(false);
    menuRef.current?.focus();
  };
  return (
    <div data-slot="app-shell">
      <a href="#main" data-slot="skip">Skip to content</a>
      <aside data-slot="sidebar">
        <div data-slot="brand-block"><Wordmark /><p data-slot="org" data-rail="hide">{ORGANIZATION_NAME}</p></div>
        <nav aria-label="Primary"><NavLinks groups={groups} pathname={pathname} /></nav>
        {footer || showSynthetic ? <p data-slot={footer ? "board-footer" : "preview-footer"} data-rail="hide">{footer ?? PREVIEW_FOOTER}</p> : null}
      </aside>
      <div data-slot="column">
        <header data-slot="topbar">
          <div data-slot="topbar-tools">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button ref={menuRef} type="button" data-slot="menu-button" aria-label="Open navigation" aria-expanded={open} aria-controls="nav-sheet"><Menu aria-hidden /></button>
              </SheetTrigger>
              <SheetContent
                id="nav-sheet"
                side="left"
                aria-describedby={undefined}
                onOpenAutoFocus={(event) => {
                  event.preventDefault();
                  document.querySelector<HTMLElement>("#nav-sheet nav a")?.focus();
                }}
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  menuRef.current?.focus();
                }}
              >
                <SheetHeader>
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <Wordmark />
                  <p data-slot="org">{ORGANIZATION_NAME}</p>
                </SheetHeader>
                <nav aria-label="Primary"><NavLinks groups={groups} pathname={pathname} onNavigate={closeSheet} /></nav>
                {footer || showSynthetic ? <p data-slot={footer ? "board-footer" : "preview-footer"}>{footer ?? PREVIEW_FOOTER}</p> : null}
              </SheetContent>
            </Sheet>
            <div data-slot="topbar-brand"><Wordmark /></div>
            <details data-slot="user-menu">
              <summary aria-label="Account menu"><span data-slot="avatar" aria-hidden>{name.slice(0, 1).toUpperCase()}</span><span data-slot="user-name">{name}<small data-slot="user-role">{roleLabel}</small></span></summary>
              <div><p>{name}</p><p data-slot="role-label">{roleLabel}</p><form action="/api/auth/signout" method="post"><button type="submit">Sign out</button></form></div>
            </details>
          </div>
          <div data-slot="topbar-sub">
            <nav data-slot="crumbs" aria-label="Breadcrumb"><ol><li aria-current="page">{crumbFor(role, pathname, PRODUCT_NAME)}</li></ol></nav>
            <AggregateFreshnessChip role={role} />
            {showSynthetic ? <span data-slot="env-badge">Synthetic data</span> : null}
          </div>
        </header>
        <Page id="main">{children}</Page>
      </div>
    </div>
  );
}
