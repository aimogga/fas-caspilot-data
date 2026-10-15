import { redirect } from "next/navigation";
import { roleHome, type UserRole } from "@/lib/auth/role-guards";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
/** `/home` is the one link every role can share: it sends each signed-in user to their own home. */
export default async function HomePage() {
  const client = await createClient();
  const role = client ? ((await client.auth.getUser()).data.user?.app_metadata?.role as UserRole | undefined) : undefined;
  redirect(roleHome(role ?? null) ?? "/403");
}
