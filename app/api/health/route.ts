import { buildHealthReport, SupabaseHealthProbe, type HealthCheck } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const checks: HealthCheck[] = [
    { name: "app", ok: true },
    { name: "supabase", ok: await SupabaseHealthProbe.responds() },
  ];
  return Response.json(buildHealthReport(checks));
}
