"use server";
// F-508h: the editor's only writes. Every edit appends to application_draft_edit before the draft changes; approval is admin-only here and in RLS.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loadApplication } from "@/lib/application/query";
import { applyEdit, approvalBlockers } from "@/lib/application/review";
import { createClient } from "@/lib/supabase/server";

async function session(id: string) {
  const client = await createClient(), user = client ? (await client.auth.getUser()).data.user : null, role = user?.app_metadata?.role;
  if (!client || !user || (role !== "admin" && role !== "staff")) throw new Error("forbidden");
  const app = await loadApplication(client, id); if (!app) throw new Error("not found");
  return { client, role, app };
}
const path = (id: string) => `/staff/grants/applications/${id}`;

export async function saveSection(form: FormData): Promise<void> {
  const id = String(form.get("id")), key = String(form.get("key")), body = String(form.get("body") ?? "").trim();
  const { client, app } = await session(id), before = app.draft.sections.find((s) => s.key === key);
  if (app.draft.status !== "DRAFT" || !before || before.body === body) return redirect(path(id));
  const log = await client.from("application_draft_edit").insert({ org_id: app.draft.org_id, application_draft_id: id, section_key: key, before: before.body, after: body });
  if (log.error) throw new Error(log.error.message);
  const upd = await client.from("application_draft").update({ sections: applyEdit(app.draft.sections, key, body, app.snapshot) }).eq("id", id);
  if (upd.error) throw new Error(upd.error.message);
  revalidatePath(path(id)); redirect(`${path(id)}#${key}`);
}

export async function approveDraft(form: FormData): Promise<void> {
  const id = String(form.get("id")), { client, role, app } = await session(id);
  if (role !== "admin") throw new Error("only an admin approves an application draft");
  if (app.draft.status !== "DRAFT" || approvalBlockers(app.draft.sections, app.snapshot).length) return redirect(path(id));
  const upd = await client.from("application_draft").update({ status: "approved" }).eq("id", id);
  if (upd.error) throw new Error(upd.error.message);
  revalidatePath(path(id)); redirect(path(id));
}

/** An approved draft is read-only; changing it starts a new DRAFT version from the same approved strategy. */
export async function newVersion(form: FormData): Promise<void> {
  const id = String(form.get("id")), { client, app } = await session(id), d = app.draft;
  const ins = await client.from("application_draft").insert({ org_id: d.org_id, opportunity_id: d.opportunity_id, strategy_draft_id: d.strategy_draft_id, status: "DRAFT", sections: d.sections }).select("id").single();
  if (ins.error || !ins.data) throw new Error(ins.error?.message || "new version failed");
  redirect(path(ins.data.id as string));
}
