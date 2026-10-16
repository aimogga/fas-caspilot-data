import { createClient } from "@/lib/supabase/server";
import { type ListRow, loadKnowledge } from "./view";

/** Rows plus the signed-in user's id (for "by you"); null when the store cannot be read. */
export async function loadPage(): Promise<{ rows: ListRow[]; me: string | null } | null> {
  try {
    const client = await createClient();
    if (!client) throw new Error("no Supabase client");
    const [rows, user] = await Promise.all([loadKnowledge(client), client.auth.getUser()]);
    return { rows, me: user.data.user?.id ?? null };
  } catch (e) {
    console.error("[knowledge] load failed", { message: e instanceof Error ? e.message : "unknown" });
    return null;
  }
}
