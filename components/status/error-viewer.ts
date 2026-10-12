"use server";

import type { UserRole } from "@/lib/auth/role-guards";
import { createClient } from "@/lib/supabase/server";
import type { ErrorViewer } from "@/lib/status/error-frame";

export type { ErrorViewer };

export async function loadErrorViewer(): Promise<ErrorViewer> {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const role = (user?.app_metadata?.role as UserRole | undefined) ?? null;
  return { signedIn: !!user, role, email: user?.email ?? null };
}
