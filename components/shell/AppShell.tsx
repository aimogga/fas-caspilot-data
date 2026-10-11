import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ORGANIZATION_NAME, PRODUCT_NAME } from "@/lib/branding";
import { createClient } from "@/lib/supabase/server";
import { roleLabel, syntheticBadgeVisible } from "@/lib/shell/nav";
import { ShellFrame } from "./ShellFrame";

export async function AppShell({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  if (!supabase) {
    return (
      <div>
        <header><p>{PRODUCT_NAME}</p></header>
        <h1>Configuration Error</h1>
        <p>Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.</p>
        <footer><p>{ORGANIZATION_NAME}</p></footer>
      </div>
    );
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const role = typeof user.app_metadata?.role === "string" ? user.app_metadata.role : "unknown";
  return (
    <ShellFrame role={role} roleLabel={roleLabel(role)} name={user.email ?? "Signed in"} showSynthetic={syntheticBadgeVisible(process.env.NEXT_PUBLIC_ENV)}>
      {children}
    </ShellFrame>
  );
}
