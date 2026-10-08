import { buildHealthReport, type HealthCheck } from "@/lib/health";

export const dynamic = "force-dynamic";

const SUPABASE_API = "http://127.0.0.1:54321/rest/v1/";

async function supabaseResponds(): Promise<boolean> {
  try {
    const response = await fetch(SUPABASE_API, {
      signal: AbortSignal.timeout(2000),
    });
    return response.status > 0;
  } catch {
    return false;
  }
}

export async function GET(): Promise<Response> {
  const checks: HealthCheck[] = [
    { name: "app", ok: true },
    { name: "supabase", ok: await supabaseResponds() },
  ];
  return Response.json(buildHealthReport(checks));
}
