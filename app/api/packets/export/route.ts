/** F-404: `GET /api/packets/export?variant=&county=&format=docx|csv` for admin and staff; a board viewer may download the statewide board
 * packet only (George, 2026-10-15). Builds the packet, refuses to ship any `assertPacket` violation (422), writes `export_job`
 * (`packet-docx` / `packet-csv`) + `audit_log`, streams the file. Board viewers cannot read FAS record rows (RLS) or insert export rows,
 * so for them the packet is built and recorded with the service role, exactly as the board dashboard does; only suppressed aggregates leave. */
import { NextResponse } from 'next/server';
import { assertPacket } from '@/lib/packets/assert';
import { isFormat, renderExport } from '@/lib/packets/export';
import { PacketQuery, parsePacketParams } from '@/lib/packets/query';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams, format = params.get('format'), now = new Date();
  if (!isFormat(format)) return NextResponse.json({ error: 'format must be docx or csv' }, { status: 400 });
  const client = await createClient();
  if (!client) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  const user = (await client.auth.getUser()).data.user, meta = user?.app_metadata ?? {};
  const board = meta.role === 'board_viewer', staff = meta.role === 'admin' || meta.role === 'staff';
  if (!user || !(staff || board) || typeof meta.org_id !== 'string') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { variant, scope } = parsePacketParams(Object.fromEntries(params));
  if (board && variant !== 'board') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const db = board ? (createServiceClient() ?? client) : client;
  const packet = await PacketQuery.load(db, variant, scope, now, null);
  const violations = assertPacket(packet);
  if (violations.length) return NextResponse.json({ error: 'packet failed export assertions', violations }, { status: 422 });
  await PacketQuery.record(db, packet, { userId: user.id, orgId: meta.org_id, exportType: `packet-${format}` })
    .catch((e: unknown) => console.error('[packets] export_job failed', { message: e instanceof Error ? e.message : 'unknown' }));
  const { body, mime, filename } = await renderExport(packet, format, now);
  return new Response(body, { headers: { 'Content-Type': mime, 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' } });
}
