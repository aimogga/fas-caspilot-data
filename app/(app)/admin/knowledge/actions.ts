"use server";
// F-508c: the only writes from the knowledge screen. Admin only (checked here and again by RLS); the privacy guard runs before every
// insert or update via parseForm and saveKnowledge. There is no delete action: rows are archived.
import { revalidatePath } from "next/cache";
import type { KnowledgeFields } from "@/lib/knowledge/guard";
import { saveKnowledge, type Status } from "@/lib/knowledge/store";
import { parseForm, STATUSES } from "@/lib/knowledge/view";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { ok: boolean; message: string } | null;
const DENIED = { ok: false, message: "Not saved: only an admin can change FAS knowledge." };

async function asAdmin() {
  const client = await createClient();
  const user = client ? (await client.auth.getUser()).data.user : null;
  const meta = (user?.app_metadata ?? {}) as { role?: string; org_id?: string };
  return client && user && meta.role === "admin" && meta.org_id ? { client, orgId: meta.org_id } : null;
}

async function write(admin: NonNullable<Awaited<ReturnType<typeof asAdmin>>>, target: { id: string } | { orgId: string }, f: KnowledgeFields & { status: Status }, done: string) {
  const res = await saveKnowledge(admin.client, target, f);
  if (!res.ok) return { ok: false, message: res.guard && !res.guard.ok ? res.guard.message : (res.error ?? "Not saved. Try again.") };
  revalidatePath("/admin/knowledge");
  return { ok: true, message: done };
}

/** Add (no id) or edit (id). An edit goes back to draft: changed text is quoted only after someone approves it again. */
export async function saveEntry(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await asAdmin(), parsed = parseForm(form);
  if (!admin) return DENIED;
  if (!parsed.ok) return parsed;
  return write(admin, parsed.id ? { id: parsed.id } : { orgId: admin.orgId }, { ...parsed.fields, status: "draft" }, parsed.id ? "Saved as a new draft version." : "Added as a draft.");
}

const DONE: Record<Status, string> = { approved: "Approved.", draft: "Returned to draft.", archived: "Archived." };
/** Approve, return to draft, or archive. The stored text is re-checked by the guard on the way through. */
export async function setStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await asAdmin(), id = String(form.get("id") ?? ""), status = String(form.get("status") ?? "") as Status;
  if (!admin) return DENIED;
  const { data } = STATUSES.includes(status) ? await admin.client.from("org_knowledge").select("category,title,body,source,as_of").eq("id", id).maybeSingle() : { data: null };
  return data ? write(admin, { id }, { ...data, status }, DONE[status]) : { ok: false, message: "Not changed: entry not found." };
}
