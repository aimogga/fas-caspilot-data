"use server";

import type { UserRole } from "@/lib/auth/role-guards";
import { createClient } from "@/lib/supabase/server";

export type ErrorViewer = { signedIn: boolean; role: UserRole | null };

export async function loadErrorViewer(): Promise<ErrorViewer> {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const role = (user?.app_metadata?.role as UserRole | undefined) ?? null;
  return { signedIn: !!user, role };
}
