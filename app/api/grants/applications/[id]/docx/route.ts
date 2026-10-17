/** F-508h: `GET /api/grants/applications/:id/docx` for admin and staff (middleware gives board a 403). Approved drafts only (409 otherwise), read under the caller's RLS, refused on any `assertPacket` violation (422), built with the existing packet DOCX builder (D-004). */
import { NextResponse } from 'next/server';
import { applicationFilename, applicationPacket } from '@/lib/application/docx';
import { recordDownload } from '@/lib/application/handoff';
import { loadApplication } from '@/lib/application/query';
import { assertPacket } from '@/lib/packets/assert';
import { packetToDocx } from '@/lib/packets/docx';
import { MIME } from '@/lib/packets/export';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const client = await createClient(); if (!client) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  const user = (await client.auth.getUser()).data.user, role = user?.app_metadata?.role;
  if (!user || (role !== 'admin' && role !== 'staff')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const app = await loadApplication(client, (await params).id); if (!app) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (app.draft.status !== 'approved') return NextResponse.json({ error: 'only an approved application draft can be downloaded' }, { status: 409 });
  const now = new Date(), packet = applicationPacket(app, now), violations = assertPacket(packet);
  if (violations.length) return NextResponse.json({ error: 'application failed export assertions', violations }, { status: 422 });
  await recordDownload(client, app.draft, user.id).catch((e: unknown) => console.error('[application] export_job failed', { message: e instanceof Error ? e.message : 'unknown' })); // F-508j, privacy rule 8
  return new Response(await packetToDocx(packet), { headers: { 'Content-Type': MIME.docx, 'Content-Disposition': `attachment; filename="${applicationFilename(packet, now)}"`, 'Cache-Control': 'no-store' } });
}
