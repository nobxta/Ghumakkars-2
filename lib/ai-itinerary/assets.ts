// Server only: logo + cover photo loading for the PDF renderer, and private storage helpers.
import { readFile } from 'fs/promises';
import path from 'path';
import { createAdminClient } from '@/lib/supabase/admin';

export const BUCKET = 'ai-itineraries';

export interface LoadedImg { data: string; w: number; h: number; format: 'JPEG' | 'PNG' }

let logoCache: { key: string; img: LoadedImg | null } | null = null;
export const BRAND_LOGO_PATH = 'branding/logo.png';

async function sharpOrNull(): Promise<any | null> {
  try {
    const mod: any = await import('sharp');
    return mod.default || mod;
  } catch {
    return null;
  }
}

/** Uploaded brand logo (private storage) or the site logo, as a small PNG; cached per version. */
export async function loadLogo(customVersion?: string | null): Promise<LoadedImg | null> {
  const key = customVersion || 'default';
  if (logoCache && logoCache.key === key) return logoCache.img;
  let raw: Buffer | null = null;
  if (customVersion) raw = await getObject(BRAND_LOGO_PATH);
  if (!raw) raw = await readFile(path.join(process.cwd(), 'public', 'logo.png')).catch(() => null);
  let img: LoadedImg | null = null;
  if (raw) {
    const sharp = await sharpOrNull();
    if (sharp) {
      const out = await sharp(raw).resize(320, 320, { fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
      const meta = await sharp(out).metadata();
      img = { data: out.toString('base64'), w: meta.width || 320, h: meta.height || 320, format: 'PNG' };
    } else {
      img = { data: raw.toString('base64'), w: 650, h: 651, format: 'PNG' };
    }
  }
  logoCache = { key, img };
  return img;
}

/** Normalise an uploaded photo for the PDF: auto-rotate, max 1800px, JPEG. */
export async function prepareImage(buf: Buffer): Promise<LoadedImg | null> {
  const sharp = await sharpOrNull();
  if (!sharp) return null;
  try {
    const out = await sharp(buf).rotate().resize(1800, 1800, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    const meta = await sharp(out).metadata();
    return { data: out.toString('base64'), w: meta.width || 1, h: meta.height || 1, format: 'JPEG' };
  } catch {
    return null;
  }
}

/** Dominant colours of an image (for "colours from your photo / reference"). */
export async function extractPalette(buf: Buffer | { raw: Buffer; width: number; height: number; channels: 1 | 2 | 3 | 4 }): Promise<{ primary: string; accent?: string } | null> {
  const sharp = await sharpOrNull();
  if (!sharp) return null;
  try {
    const input = Buffer.isBuffer(buf) ? sharp(buf) : sharp(buf.raw, { raw: { width: buf.width, height: buf.height, channels: buf.channels } });
    const { data, info } = await input.resize(48, 48, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    // Bucket colours by hue; score by saturation × count so we pick a characterful colour, not grey.
    const buckets = new Map<number, { r: number; g: number; b: number; n: number; s: number }>();
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 510;
      const s = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
      if (l < 0.12 || l > 0.9 || s < 0.18) continue;
      let h = 0;
      if (max !== min) {
        const d = max - min;
        h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      }
      const key = Math.round(h * 2) % 12; // 12 hue buckets
      const bk = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0, s: 0 };
      bk.r += r; bk.g += g; bk.b += b; bk.n++; bk.s += s;
      buckets.set(key, bk);
    }
    const ranked = Array.from(buckets.entries()).map(([k, v]) => ({ k, v, score: v.n * (v.s / v.n) })).sort((a, b) => b.score - a.score);
    if (!ranked.length) return null;
    const hex = (v: { r: number; g: number; b: number; n: number }) => '#' + [v.r, v.g, v.b].map((c) => Math.round(c / v.n).toString(16).padStart(2, '0')).join('').toUpperCase();
    const primary = hex(ranked[0].v);
    const far = ranked.slice(1).find((x) => Math.min(Math.abs(x.k - ranked[0].k), 12 - Math.abs(x.k - ranked[0].k)) >= 3);
    return { primary, accent: far ? hex(far.v) : undefined };
  } catch {
    return null;
  }
}

const ALLOWED_IMAGE_HOSTS = ['res.cloudinary.com', 'images.unsplash.com', 'plus.unsplash.com'];

/** Real destination photo from our own published trips (never stock filler). */
export async function findTripPhoto(destination: string): Promise<LoadedImg | null> {
  const dest = destination.split(/[,&/]| and /i)[0]?.trim();
  if (!dest || dest.length < 3) return null;
  try {
    const db = createAdminClient();
    const safe = dest.replace(/[%_,()]/g, ' ').trim();
    const { data } = await db.from('trips').select('cover_image_url, image_url').or(`destination.ilike.%${safe}%,title.ilike.%${safe}%`).limit(5);
    const url = (data || []).map((t: any) => t.cover_image_url || t.image_url).find(Boolean);
    if (!url) return null;
    const u = new URL(url);
    if (u.protocol !== 'https:' || !ALLOWED_IMAGE_HOSTS.includes(u.hostname)) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(u.toString(), { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 15 * 1024 * 1024) return null;
    return prepareImage(buf);
  } catch {
    return null;
  }
}

/** @deprecated kept for compatibility; use findTripPhoto. */
export async function findCoverImage(destination: string, aspect: number): Promise<{ data: string; aspect: number } | null> {
  const dest = destination.split(/[,&/]| and /i)[0]?.trim();
  if (!dest || dest.length < 3) return null;
  const sharp = await sharpOrNull();
  if (!sharp) return null;
  try {
    const db = createAdminClient();
    const safe = dest.replace(/[%_,()]/g, ' ').trim();
    const { data } = await db
      .from('trips')
      .select('cover_image_url, image_url')
      .or(`destination.ilike.%${safe}%,title.ilike.%${safe}%`)
      .limit(5);
    const url = (data || []).map((t: any) => t.cover_image_url || t.image_url).find(Boolean);
    if (!url) return null;
    const u = new URL(url);
    if (u.protocol !== 'https:' || !ALLOWED_IMAGE_HOSTS.includes(u.hostname)) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(u.toString(), { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 15 * 1024 * 1024) return null;
    const width = 1400;
    const height = Math.round(width / aspect);
    const out = await sharp(buf).rotate().resize(width, height, { fit: 'cover', position: 'attention' }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    return { data: out.toString('base64'), aspect };
  } catch {
    return null;
  }
}

let bucketChecked = false;

/** Creates the private bucket if the migration didn't (e.g. a fresh environment). */
export async function ensureBucket() {
  if (bucketChecked) return;
  const db = createAdminClient();
  const { data } = await db.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await db.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 26214400 });
    if (error && !/already exists/i.test(error.message)) throw new Error(`Storage is not configured: ${error.message}`);
  }
  bucketChecked = true;
}

export async function putObject(objectPath: string, body: Buffer, contentType: string) {
  await ensureBucket();
  const db = createAdminClient();
  const { error } = await db.storage.from(BUCKET).upload(objectPath, body, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

export async function getObject(objectPath: string): Promise<Buffer | null> {
  const db = createAdminClient();
  const { data, error } = await db.storage.from(BUCKET).download(objectPath);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function removeObjects(paths: string[]) {
  if (!paths.length) return;
  const db = createAdminClient();
  for (let i = 0; i < paths.length; i += 100) await db.storage.from(BUCKET).remove(paths.slice(i, i + 100));
}
