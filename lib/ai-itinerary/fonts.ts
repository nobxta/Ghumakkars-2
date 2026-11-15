// Server only: loads the embedded PDF fonts (assets/pdf-fonts, OFL licensed, subset to Latin + ₹).
import { readFile } from 'fs/promises';
import path from 'path';
import type { DesignSpec } from './design';

const cache = new Map<string, string>();

async function load(name: string): Promise<string | null> {
  if (cache.has(name)) return cache.get(name)!;
  try {
    const buf = await readFile(path.join(process.cwd(), 'assets', 'pdf-fonts', `${name}.ttf`));
    const b64 = buf.toString('base64');
    cache.set(name, b64);
    return b64;
  } catch {
    return null;
  }
}

/** Base64 TTF data for every face the design uses (+ Inter as a safe fallback). */
export async function fontsFor(d: DesignSpec): Promise<Record<string, string>> {
  const f = d.fonts;
  const names = Array.from(new Set([f.head, f.headItalic, f.body, f.bodyMedium, f.bodyBold, f.bodyItalic, 'Inter-Regular', 'Inter-SemiBold']));
  const out: Record<string, string> = {};
  await Promise.all(names.map(async (n) => { const v = await load(n); if (v) out[n] = v; }));
  return out;
}
