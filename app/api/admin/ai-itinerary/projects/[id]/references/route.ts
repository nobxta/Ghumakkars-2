import { adminRoute, json } from '@/lib/ai-itinerary/http';
import { getSettings } from '@/lib/ai-itinerary/settings';
import { addReference, isPurpose } from '@/lib/ai-itinerary/references';
import { StudioError, loadProject } from '@/lib/ai-itinerary/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Upload one reference file (multipart: file, purpose). Text is extracted server-side. */
export const POST = adminRoute(async ({ req, params }) => {
  await loadProject(params.id);
  const settings = await getSettings();
  const len = Number(req.headers.get('content-length') || 0);
  if (len > (settings.references.maxFileMB + 1) * 1024 * 1024) throw new StudioError(413, 'too_large', `File is larger than ${settings.references.maxFileMB} MB`);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new StudioError(400, 'invalid', 'Upload was not a valid form');
  }
  const file = form.get('file');
  if (!(file instanceof File)) throw new StudioError(400, 'invalid', 'No file attached');
  const purpose = form.get('purpose');
  const ref = await addReference(settings, params.id, file, isPurpose(purpose) ? purpose : 'auto');
  return json({ reference: ref }, 201);
});
