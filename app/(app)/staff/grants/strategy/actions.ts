"use server";

// F-508f: generate (staff and admin) and review (admin only). RLS from #231 enforces the same rules in the database.
import { redirect } from "next/navigation";
import { startOrOpen } from "@/lib/application/handoff";
import { createStrategyDraft } from "@/lib/strategy/generate";
import { fakeEnabled, fakeGenerate } from "@/lib/strategy/fake";
import { createClient } from "@/lib/supabase/server";

async function caller() {
  const client = await createClient();
  const user = client ? (await client.auth.getUser()).data.user : null;
  return { client, role: user?.app_metadata?.role as string | undefined, orgId: user?.app_metadata?.org_id as string | undefined };
}

export type GenerateState = { error: string } | null;

export async function generateStrategy(_prev: GenerateState, form: FormData): Promise<GenerateState> {
  const { client, role, orgId } = await caller(), opportunityId = String(form.get("opportunityId") ?? "");
  if (!client || !orgId || (role !== "staff" && role !== "admin")) return { error: "Only staff and admins can draft a strategy." };
  const id = await createStrategyDraft(client, orgId, opportunityId, new Date(), fakeEnabled() ? fakeGenerate : undefined)
    .then((r) => r.id, (e: unknown) => void console.error("[strategy] generate failed", { message: e instanceof Error ? e.message : "unknown" }));
  if (!id) return { error: "Couldn't start a draft from the stored rows. Try again." };
  redirect(`/staff/grants/strategy/${id}`);
}

export async function reviewStrategy(id: string, status: "approved" | "rejected"): Promise<void> {
  const { client, role } = await caller();
  if (!client || role !== "admin") redirect(`/staff/grants/strategy/${id}?review=denied`);
  const { data, error } = await client.from("strategy_draft").update({ status }).eq("id", id).select("id");
  const failed = !!error || !data?.length;
  if (failed) console.error("[strategy] review failed", { message: error?.message ?? "no row updated" });
  redirect(`/staff/grants/strategy/${id}${failed ? "?review=failed" : ""}`);
}

/** F-508j: write the application from an approved strategy, or open its newest draft (never a duplicate). Refusals come back in plain words. */
export async function writeApplication(_prev: GenerateState, form: FormData): Promise<GenerateState> {
  const { client, role } = await caller(), strategyId = String(form.get("strategyId") ?? "");
  if (!client || (role !== "staff" && role !== "admin")) return { error: "Only staff and admins can write an application." };
  const r = await startOrOpen(client, strategyId, fakeEnabled() ? fakeGenerate : undefined)
    .catch((e: unknown) => ({ error: (console.error("[application] start failed", { message: e instanceof Error ? e.message : "unknown" }), "Couldn't write the application. Try again.") }));
  if ("error" in r) return { error: r.error };
  redirect(`/staff/grants/applications/${r.id}`);
}
