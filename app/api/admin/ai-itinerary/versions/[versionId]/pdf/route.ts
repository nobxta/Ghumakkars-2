import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { adminRoute } from '@/lib/ai-itinerary/http';
import { getObject } from '@/lib/ai-itinerary/assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Streams a stored PDF to an admin. Storage stays private — there are no public URLs. */
export const GET = adminRoute(async ({ req, params }) => {
  const { data: v } = await createAdminClient()
    .from('ai_itinerary_versions')
    .select('pdf_path, version_no, itinerary, project_id')
    .eq('id', params.versionId)
    .maybeSingle();
  if (!v?.pdf_path) return NextResponse.json({ error: 'PDF not found' }, { status: 404 });
  const buf = await getObject(v.pdf_path);
  if (!buf) return NextResponse.json({ error: 'The PDF file is missing from storage. Restore or re-render this version.' }, { status: 410 });
  const title = String((v.itinerary as any)?.title || 'itinerary').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 80) || 'itinerary';
  const download = new URL(req.url).searchParams.get('download') === '1';
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(buf.length),
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${title}-v${v.version_no}.pdf"`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
