import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { adminRoute, json, readJson } from '@/lib/ai-itinerary/http';
import { getObject, removeObjects } from '@/lib/ai-itinerary/assets';
import { isPurpose } from '@/lib/ai-itinerary/references';
import { StudioError } from '@/lib/ai-itinerary/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function load(projectId: string, refId: string) {
  const { data } = await createAdminClient().from('ai_itinerary_references').select('*').eq('id', refId).eq('project_id', projectId).maybeSingle();
  if (!data) throw new StudioError(404, 'not_found', 'Reference file not found');
  return data;
}

/** ?file=1 streams the original file; otherwise returns metadata + a text preview. */
export const GET = adminRoute(async ({ req, params }) => {
  const ref = await load(params.id, params.refId);
  if (new URL(req.url).searchParams.get('file') === '1') {
    const buf = await getObject(ref.storage_path);
    if (!buf) return NextResponse.json({ error: 'The file is no longer in storage' }, { status: 410 });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': ref.mime_type.startsWith('image/') || ref.mime_type === 'application/pdf' ? ref.mime_type : 'text/plain; charset=utf-8',
        'Content-Disposition': `inline; filename="${ref.filename.replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
  const { extracted_text, storage_path, ...meta } = ref;
  return json({ reference: { ...meta, preview: String(extracted_text || '').slice(0, 4000) } });
});

/** Update purpose (documents) or photo placement: image_role, image_day, caption. */
export const PATCH = adminRoute(async ({ req, params }) => {
  const body = await readJson(req);
  const ref = await load(params.id, params.refId);
  const patch: Record<string, unknown> = {};
  if ('purpose' in body) {
    if (!isPurpose(body.purpose) || body.purpose === 'photo') throw new StudioError(400, 'invalid', 'Unknown purpose');
    patch.purpose = body.purpose;
  }
  if (ref.kind === 'image') {
    if ('image_role' in body) {
      if (!['auto', 'cover', 'day', 'gallery', 'exclude'].includes(body.image_role)) throw new StudioError(400, 'invalid', 'Unknown photo role');
      patch.image_role = body.image_role;
    }
    if ('image_day' in body) patch.image_day = Number.isInteger(body.image_day) && body.image_day > 0 && body.image_day < 100 ? body.image_day : null;
    if ('caption' in body) patch.caption = typeof body.caption === 'string' ? body.caption.slice(0, 160) || null : null;
  }
  if (!Object.keys(patch).length) throw new StudioError(400, 'invalid', 'Nothing to update');
  await createAdminClient().from('ai_itinerary_references').update(patch).eq('id', params.refId);
  return json({ ok: true });
});

export const DELETE = adminRoute(async ({ params }) => {
  const ref = await load(params.id, params.refId);
  await removeObjects([ref.storage_path]).catch(() => undefined);
  await createAdminClient().from('ai_itinerary_references').delete().eq('id', params.refId);
  return json({ ok: true });
});
