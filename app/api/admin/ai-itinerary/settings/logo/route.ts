import { NextResponse } from 'next/server';
import { adminRoute, json } from '@/lib/ai-itinerary/http';
import { getSettings, saveSettings } from '@/lib/ai-itinerary/settings';
import { BRAND_LOGO_PATH, getObject, loadLogo, putObject, removeObjects } from '@/lib/ai-itinerary/assets';
import { StudioError } from '@/lib/ai-itinerary/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Current brand logo as PNG (uploaded one, or the site logo). */
export const GET = adminRoute(async () => {
  const settings = await getSettings();
  const img = await loadLogo(settings.pdf.logoVersion);
  if (!img) return NextResponse.json({ error: 'No logo' }, { status: 404 });
  return new NextResponse(new Uint8Array(Buffer.from(img.data, 'base64')), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=60' },
  });
});

/** Upload a logo (PNG/JPEG/WebP ≤ 5 MB). Stored privately, normalised to PNG. */
export const POST = adminRoute(async ({ req }) => {
  let form: FormData;
  try { form = await req.formData(); } catch { throw new StudioError(400, 'invalid', 'Upload was not a valid form'); }
  const file = form.get('file');
  if (!(file instanceof File)) throw new StudioError(400, 'invalid', 'No file attached');
  if (file.size > 5 * 1024 * 1024) throw new StudioError(413, 'too_large', 'Logo must be under 5 MB');
  const buf = Buffer.from(await file.arrayBuffer());
  const sharp = (await import('sharp')).default;
  let png: Buffer;
  try {
    png = await sharp(buf).rotate().resize(800, 800, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  } catch {
    throw new StudioError(415, 'type', 'That file is not a readable image (use PNG, JPG or WebP)');
  }
  await putObject(BRAND_LOGO_PATH, png, 'image/png');
  const s = await getSettings(true);
  s.pdf.logoVersion = new Date().toISOString();
  return json({ settings: await saveSettings(s) });
});

/** Revert to the site logo. */
export const DELETE = adminRoute(async () => {
  if (await getObject(BRAND_LOGO_PATH)) await removeObjects([BRAND_LOGO_PATH]);
  const s = await getSettings(true);
  s.pdf.logoVersion = null;
  return json({ settings: await saveSettings(s) });
});
