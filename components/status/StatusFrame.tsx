import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { roleHome, type UserRole } from "@/lib/auth/role-guards";
import { createClient } from "@/lib/supabase/server";
import { SignedOutFrame } from "./SignedOutFrame";

export type Viewer = { signedIn: boolean; role: UserRole | null; home: string | null };

export async function getViewer(): Promise<Viewer> {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const role = (user?.app_metadata?.role as UserRole | undefined) ?? null;
  return { signedIn: !!user, role, home: roleHome(role) };
}

export function StatusFrame({ viewer, crumb, children }: { viewer: Viewer; crumb?: string; children: ReactNode }) {
  if (viewer.signedIn) return <AppShell crumb={crumb}>{children}</AppShell>;
  return <SignedOutFrame>{children}</SignedOutFrame>;
}
