// Server only: validate, store and extract uploaded reference files and photos.
import { createAdminClient } from '@/lib/supabase/admin';
import { extractPalette, putObject } from './assets';
import { StudioError } from './service';
import type { ReferencePurpose, StudioSettings } from './types';

const PURPOSES: ReferencePurpose[] = ['auto', 'extract', 'structure', 'design', 'compare', 'rewrite', 'terms', 'new_from_old', 'photo'];
export const isPurpose = (p: unknown): p is ReferencePurpose => PURPOSES.includes(p as ReferencePurpose);

type Detected = 'application/pdf' | 'text/plain' | 'text/markdown' | 'image/jpeg' | 'image/png' | 'image/webp';

function detectType(name: string, declared: string, head: Buffer): Detected | null {
  if (head.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  const lower = name.toLowerCase();
  const looksText = !head.subarray(0, 4096).includes(0);
  if (!looksText) return null;
  if (lower.endsWith('.md') || declared === 'text/markdown') return 'text/markdown';
  if (lower.endsWith('.txt') || declared.startsWith('text/')) return 'text/plain';
  return null;
}

async function extractPdf(buf: Buffer, wantColours: boolean): Promise<{ text: string; pages: number; palette: { primary: string; accent?: string } | null }> {
  const { extractText, getDocumentProxy, extractImages } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  let palette: { primary: string; accent?: string } | null = null;
  if (wantColours) {
    // Colours of the reference's imagery (first pages) — a hint for the design, not a copy of its layout.
    try {
      for (let p = 1; p <= Math.min(3, totalPages) && !palette; p++) {
        const imgs = await extractImages(pdf, p);
        const big = imgs.filter((i) => i.width * i.height > 40_000).sort((a, b) => b.width * b.height - a.width * a.height)[0];
        if (big) palette = await extractPalette({ raw: Buffer.from(big.data), width: big.width, height: big.height, channels: big.channels });
      }
    } catch { /* colour extraction is best-effort */ }
  }
  return { text: String(text || ''), pages: totalPages, palette };
}

const tidy = (s: string) => s.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();

export async function addReference(settings: StudioSettings, projectId: string, file: File, purpose: ReferencePurpose) {
  const db = createAdminClient();
  const buf = Buffer.from(await file.arrayBuffer());
  const type = detectType(file.name, file.type || '', buf);
  const isImage = !!type && type.startsWith('image/');
  const maxMB = isImage ? Math.max(settings.references.maxFileMB, 15) : settings.references.maxFileMB;
  if (file.size > Math.min(25, maxMB) * 1024 * 1024) throw new StudioError(413, 'too_large', `File is larger than ${Math.min(25, maxMB)} MB`);
  if (file.size === 0) throw new StudioError(400, 'empty', 'File is empty');
  if (!type || (!isImage && !settings.references.allowedTypes.includes(type))) throw new StudioError(415, 'type', 'Supported: PDF, TXT, Markdown, and photos (JPG, PNG, WebP)');

  const { count } = await db.from('ai_itinerary_references').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('kind', isImage ? 'image' : 'document');
  const limit = isImage ? 20 : settings.references.maxFilesPerProject;
  if ((count || 0) >= limit) throw new StudioError(400, 'limit', `This itinerary already has ${count} ${isImage ? 'photos' : 'reference files'} (limit ${limit})`);

  const filename = file.name.replace(/[^\w.\- ()]+/g, '_').slice(0, 120) || (isImage ? 'photo' : 'reference');
  const id = crypto.randomUUID();
  const ext = type === 'application/pdf' ? '.pdf' : type === 'image/jpeg' ? '.jpg' : type === 'image/png' ? '.png' : type === 'image/webp' ? '.webp' : '.txt';
  const storagePath = `${isImage ? 'photos' : 'references'}/${projectId}/${id}${ext}`;
  await putObject(storagePath, buf, type);

  const { error } = await db.from('ai_itinerary_references').insert({
    id, project_id: projectId, filename, mime_type: type, size_bytes: buf.length, storage_path: storagePath,
    purpose: isImage ? 'photo' : purpose === 'photo' ? 'auto' : purpose, status: 'processing',
    kind: isImage ? 'image' : 'document', image_role: isImage ? 'auto' : null,
  });
  if (error) throw new StudioError(500, 'db', error.message);

  let text = '';
  let pages: number | null = null;
  let status: 'ready' | 'failed' = 'ready';
  let err: string | null = null;
  const meta: Record<string, unknown> = {};
  try {
    if (isImage) {
      const sharp = (await import('sharp')).default;
      const m = await sharp(buf).metadata();
      meta.width = m.width; meta.height = m.height;
      if (!m.width || !m.height) throw new Error('unreadable');
      if (m.width < 600) err = 'Low resolution — may look soft when printed.';
      meta.palette = await extractPalette(buf);
    } else if (type === 'application/pdf') {
      const r = await extractPdf(buf, purpose === 'design' || purpose === 'auto');
      text = tidy(r.text);
      pages = r.pages;
      if (r.palette) meta.palette = r.palette;
      if (text.length < 20) {
        if (purpose === 'design') err = 'No selectable text (image-only PDF). Its colours can still guide the design.';
        else { status = 'failed'; err = 'No selectable text found — this looks like a scanned/image PDF. OCR is not available.'; }
      }
    } else {
      text = tidy(buf.toString('utf8'));
    }
  } catch (e) {
    status = 'failed';
    err = isImage ? 'Could not read this image.' : /password|encrypt/i.test((e as Error).message) ? 'This PDF is password-protected.' : 'Could not read text from this file.';
  }
  await db.from('ai_itinerary_references').update({ status, extracted_text: text.slice(0, 200_000), page_count: pages, error: err, meta }).eq('id', id);
  const { data } = await db.from('ai_itinerary_references')
    .select('id, project_id, filename, mime_type, size_bytes, purpose, status, page_count, error, created_at, kind, image_role, image_day, caption, meta')
    .eq('id', id).single();
  return data;
}
