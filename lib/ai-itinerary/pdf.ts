/**
 * Itinerary PDF renderer (jsPDF, runs in Node — no headless browser).
 *
 * Every document is composed from a DesignSpec (see design.ts): embedded premium
 * fonts, a palette, one of eight cover compositions, day pages whose layout varies
 * from day to day, decorative motifs, and the admin's own photos, logo and contact
 * details. Content always comes from a validated Itinerary, so re-designing never
 * needs the AI.
 *
 * Layout rules: blocks are measured before drawing and moved to the next page when
 * they don't fit (no clipped text, no orphan headings); long text flows line by line;
 * headers/footers/page numbers are stamped in a final pass.
 */
import { jsPDF } from 'jspdf';
import { FONTS_WITHOUT_RUPEE, type DesignSpec, type DayStyle } from './design';
import { SECTION_LABELS, type Itinerary, type ItineraryDay, type SectionKey, type ThemeOptions } from './types';

export interface RenderBrand {
  companyName: string;
  tagline?: string;
  contactPerson?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  instagram?: string;
  address?: string;
}

export interface Img { data: string; w: number; h: number; format: 'JPEG' | 'PNG' }

export interface RenderInput {
  itinerary: Itinerary;
  design: DesignSpec;
  options: ThemeOptions;
  brand: RenderBrand;
  logo?: Img | null;
  photos?: { cover?: Img | null; days?: Record<number, Img>; gallery?: Img[] };
  /** base64 TTF data keyed by font file name (assets/pdf-fonts/<name>.ttf). */
  fonts: Record<string, string>;
}

type RGB = [number, number, number];
type Role = 'head' | 'headItalic' | 'body' | 'bodyMedium' | 'bodyBold' | 'bodyItalic';

function rgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export function mix(hex: string, withHex: string, t: number): RGB {
  const a = rgb(hex), b = rgb(withHex);
  return [0, 1, 2].map((i) => Math.round(a[i] * (1 - t) + b[i] * t)) as RGB;
}

/** Keep only characters the embedded font subsets contain. */
export function pdfSafe(s: string | undefined | null): string {
  if (!s) return '';
  return s
    .replace(/[⟶➝➔]/g, '→')
    .replace(/[●▪◦]/g, '•')
    .replace(/ /g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF–—‘’“”•…₹←→™×′″·]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

const PT = 0.352778; // mm per pt
const WHITE = '#FFFFFF';

class Writer {
  doc: jsPDF;
  W: number;
  H: number;
  M: number;
  top: number;
  bottom: number;
  y = 0;
  d: DesignSpec;
  k: number;
  o: ThemeOptions;
  input: RenderInput;
  noChrome = new Set<number>();
  currentFont = '';
  sectionNo = 0;

  constructor(input: RenderInput) {
    this.input = input;
    this.d = input.design;
    this.o = input.options;
    this.k = this.o.density === 'compact' ? 0.88 : 1;
    this.doc = new jsPDF({
      unit: 'mm',
      format: this.o.paper === 'letter' ? 'letter' : 'a4',
      orientation: this.o.orientation === 'landscape' ? 'landscape' : 'portrait',
      compress: true,
    });
    this.doc.setLineHeightFactor(1.38);
    this.registerFonts();
    this.W = this.doc.internal.pageSize.getWidth();
    this.H = this.doc.internal.pageSize.getHeight();
    this.M = this.o.density === 'compact' ? 14 : 17;
    this.top = this.o.header === false ? this.M : this.M + 9;
    this.bottom = this.H - (this.o.footer === false ? this.M : this.M + 7);
    this.y = this.top;
  }

  get p() { return this.d.palette; }
  get cw() { return this.W - this.M * 2; }

  registerFonts() {
    const f = this.d.fonts;
    const names = Array.from(new Set([f.head, f.headItalic, f.body, f.bodyMedium, f.bodyBold, f.bodyItalic, 'Inter-Regular', 'Inter-SemiBold']));
    for (const n of names) {
      const data = this.input.fonts[n];
      if (!data) continue;
      this.doc.addFileToVFS(`${n}.ttf`, data);
      this.doc.addFont(`${n}.ttf`, n, 'normal');
    }
  }

  font(role: Role, size: number) {
    let name = this.d.fonts[role];
    if (!this.input.fonts[name]) name = role.startsWith('head') ? 'Inter-SemiBold' : 'Inter-Regular';
    if (!this.input.fonts[name]) { this.doc.setFont('helvetica', role.includes('Bold') || role === 'head' ? 'bold' : 'normal'); this.currentFont = 'helvetica'; }
    else { this.doc.setFont(name, 'normal'); this.currentFont = name; }
    const scale = role === 'head' ? this.d.fonts.headScale : 1;
    this.doc.setFontSize(size * scale * (role.startsWith('body') ? this.k : Math.max(this.k, 0.94)));
  }
  /** Text safe for the current font (₹ → "Rs." where the face lacks the glyph). */
  t(s: string | undefined | null) {
    let v = pdfSafe(s);
    if (FONTS_WITHOUT_RUPEE.has(this.currentFont) || this.currentFont === 'helvetica') v = v.replace(/₹\s?/g, 'Rs. ').replace(/[→←]/g, '-');
    return v;
  }
  upper(s: string) { return this.d.coverTitleUpper ? s.toUpperCase() : s; }
  lh() { return this.doc.getFontSize() * PT * 1.38; }
  split(s: string, w: number): string[] { return this.doc.splitTextToSize(this.t(s), w) as string[]; }
  measure(s: string, w: number, role: Role, size: number) { this.font(role, size); const lines = this.split(s, w); return { lines, h: lines.length * this.lh() }; }

  fill(c: string | RGB) { const v = typeof c === 'string' ? rgb(c) : c; this.doc.setFillColor(v[0], v[1], v[2]); }
  stroke(c: string | RGB) { const v = typeof c === 'string' ? rgb(c) : c; this.doc.setDrawColor(v[0], v[1], v[2]); }
  color(c: string | RGB) { const v = typeof c === 'string' ? rgb(c) : c; this.doc.setTextColor(v[0], v[1], v[2]); }
  alpha(o: number) { const G = (this.doc as any).GState; if (G) (this.doc as any).setGState(new G({ opacity: o })); }
  gap(mm: number) { this.y += mm * this.k; }

  paintPaper() { if (this.p.paper.toUpperCase() !== WHITE) { this.fill(this.p.paper); this.doc.rect(0, 0, this.W, this.H, 'F'); } }
  newPage(opts: { chrome?: boolean } = {}) {
    this.doc.addPage();
    this.paintPaper();
    if (opts.chrome === false) this.noChrome.add(this.doc.getNumberOfPages());
    this.y = this.top;
  }
  ensure(h: number) { if (this.y + h > this.bottom) this.newPage(); }

  /** Flowing text, breaks across pages line by line. */
  para(s: string | undefined, o: { size?: number; role?: Role; color?: string | RGB; x?: number; width?: number; after?: number } = {}) {
    if (!s) return;
    this.font(o.role || 'body', o.size || 10);
    this.color(o.color || this.p.ink);
    const x = o.x ?? this.M;
    const width = o.width ?? this.W - this.M - x;
    for (const line of this.split(s, width)) {
      this.ensure(this.lh());
      this.doc.text(line, x, this.y, { baseline: 'top' });
      this.y += this.lh();
    }
    this.gap(o.after ?? 2.5);
  }

  textAt(s: string, x: number, y: number, o: { role?: Role; size?: number; color?: string | RGB; align?: 'left' | 'center' | 'right'; maxW?: number; spacing?: number } = {}) {
    this.font(o.role || 'body', o.size || 10);
    this.color(o.color || this.p.ink);
    const v = this.t(s);
    const lines = o.maxW ? (this.doc.splitTextToSize(v, o.maxW) as string[]) : [v];
    this.doc.text(lines, x, y, { baseline: 'top', align: o.align, charSpace: o.spacing });
    return lines.length * this.lh();
  }

  /* ── shapes, photos, motifs ── */

  poly(pts: [number, number][], style: 'F' | 'S' = 'F') {
    const rel: [number, number][] = [];
    for (let i = 1; i < pts.length; i++) rel.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
    this.doc.lines(rel as any, pts[0][0], pts[0][1], [1, 1], style, true);
  }

  /** Arch path: rectangle with a semicircular top (bezier). style null = path only (for clipping). */
  archPath(x: number, y: number, w: number, h: number, style: 'S' | null = null) {
    const r = w / 2;
    const c = 0.5523 * r;
    this.doc.lines(
      [[0, -(h - r)], [0, -c, r - c, -r, r, -r], [c, 0, r, r - c, r, r], [0, h - r]] as any,
      x, y + h, [1, 1], style as any, true,
    );
  }

  photo(img: Img, x: number, y: number, w: number, h: number, shape: 'rect' | 'round' | 'arch' | 'circle' = 'rect', radius = 3) {
    const doc = this.doc as any;
    const s = Math.max(w / img.w, h / img.h); // cover-fit, centred
    const dw = img.w * s, dh = img.h * s;
    doc.saveGraphicsState();
    if (shape === 'round') doc.roundedRect(x, y, w, h, radius, radius, null);
    else if (shape === 'circle') doc.circle(x + w / 2, y + h / 2, Math.min(w, h) / 2, null);
    else if (shape === 'arch') this.archPath(x, y, w, h, null);
    else doc.rect(x, y, w, h, null);
    doc.clip();
    doc.discardPath();
    try { doc.addImage(img.data, img.format, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, `img-${img.w}x${img.h}-${img.data.length}-${img.data.slice(100, 140)}`, 'MEDIUM'); } catch { /* skip broken image */ }
    doc.restoreGraphicsState();
  }

  logo(x: number, y: number, size: number) {
    const lg = this.input.logo;
    if (!lg || this.o.logo === 'none') return 0;
    const h = size * (lg.h / lg.w);
    try { this.doc.addImage(lg.data, lg.format, x, y, size, h, 'brandlogo', 'FAST'); } catch { return 0; }
    return h;
  }

  motif(kind: string, x: number, y: number, w: number, h: number, color: string | RGB, opacity = 0.14) {
    if (kind === 'none') return;
    const doc = this.doc;
    this.alpha(opacity);
    this.fill(color);
    this.stroke(color);
    if (kind === 'mountains') {
      const base = y + h;
      this.poly([[x, base], [x + w * 0.22, y + h * 0.35], [x + w * 0.36, y + h * 0.58], [x + w * 0.55, y + h * 0.1], [x + w * 0.78, y + h * 0.5], [x + w * 0.9, y + h * 0.3], [x + w, y + h * 0.55], [x + w, base]]);
      this.alpha(opacity * 0.7);
      this.poly([[x, base], [x + w * 0.15, y + h * 0.62], [x + w * 0.42, y + h * 0.4], [x + w * 0.68, y + h * 0.7], [x + w, y + h * 0.48], [x + w, base]]);
    } else if (kind === 'waves') {
      doc.setLineWidth(0.8);
      const seg = w / 4;
      for (let i = 0; i < 5; i++) {
        const yy = y + (h / 5) * i + 3;
        const wave = [seg / 2, -4, seg / 2, 4, seg, 0];
        doc.lines([wave, wave, wave, wave] as any, x, yy, [1, 1], 'S', false);
      }
    } else if (kind === 'dots') {
      for (let yy = y + 2; yy < y + h; yy += 5.5) for (let xx = x + 2; xx < x + w; xx += 5.5) doc.circle(xx, yy, 0.55, 'F');
    } else if (kind === 'sun') {
      doc.setLineWidth(0.5);
      const cx = x + w / 2, cy = y + h / 2, R = Math.min(w, h) / 2;
      for (let r = R; r > 3; r -= R / 6) doc.circle(cx, cy, r, 'S');
    } else if (kind === 'lines') {
      doc.setLineWidth(0.35);
      for (let i = 0; i < w + h; i += 4.5) {
        const x1 = x + Math.min(i, w), y1 = y + Math.max(0, i - w);
        const x2 = x + Math.max(0, i - h), y2 = y + Math.min(i, h);
        doc.line(x1, y1, x2, y2);
      }
    }
    this.alpha(1);
  }
}

/* ═══════════════════════════════ covers ═══════════════════════════════ */

function factChips(it: Itinerary): string[] {
  const out: string[] = [];
  const add = (s?: string) => {
    const v = pdfSafe(s);
    if (!v) return;
    const k = v.toLowerCase().replace(/[^a-z0-9]/g, '');
    // skip near-duplicates such as "College student group" vs "College students"
    if (out.some((o) => { const ok = o.toLowerCase().replace(/[^a-z0-9]/g, ''); return ok.includes(k.slice(0, 10)) || k.includes(ok.slice(0, 10)); })) return;
    out.push(v);
  };
  add(it.durationLabel);
  add(it.startLocation ? `From ${it.startLocation}` : '');
  add(it.dates);
  add(it.travellers ? `${it.travellers}${/^\d+$/.test(it.travellers) ? ' travellers' : ''}` : '');
  add(it.audience);
  return out.slice(0, 4);
}

function chips(w: Writer, items: string[], x: number, y: number, maxW: number, fg: string | RGB, bg: string | RGB | null, border?: string | RGB) {
  w.font('bodyMedium', 8.6);
  let cx = x, cy = y;
  const h = 7.4;
  for (const s of items) {
    const label = w.t(s);
    const tw = w.doc.getTextWidth(label) + 8;
    if (cx + tw > x + maxW) { cx = x; cy += h + 2.4; }
    if (bg) { w.fill(bg); w.doc.roundedRect(cx, cy, tw, h, h / 2, h / 2, 'F'); }
    if (border) { w.stroke(border); w.doc.setLineWidth(0.3); w.doc.roundedRect(cx, cy, tw, h, h / 2, h / 2, 'S'); }
    w.color(fg);
    w.doc.text(label, cx + 4, cy + h / 2 + 0.2, { baseline: 'middle' });
    cx += tw + 2.4;
  }
  return cy + h;
}

function coverTitle(w: Writer, title: string, x: number, y: number, maxW: number, color: string | RGB, size: number, align: 'left' | 'center' = 'left') {
  let s = size;
  w.font('head', s);
  let lines = w.split(w.upper(title), maxW);
  while (lines.length > 3 && s > 20) { s -= 2; w.font('head', s); lines = w.split(w.upper(title), maxW); }
  w.color(color);
  w.doc.text(lines, align === 'center' ? x + maxW / 2 : x, y, { baseline: 'top', align, lineHeightFactor: 1.1 } as any);
  return lines.length * w.doc.getFontSize() * PT * 1.1;
}

function coverFooter(w: Writer, color: string | RGB, muted: string | RGB) {
  const b = w.input.brand;
  w.textAt(b.companyName, w.M, w.H - w.M - 4, { role: 'bodyBold', size: 9.5, color });
  const right = [b.website, b.phone].filter(Boolean).join('   ·   ');
  if (right) w.textAt(right, w.W - w.M, w.H - w.M - 4, { role: 'body', size: 8.6, color: muted, align: 'right' });
}

function highlightsOnCover(w: Writer, x: number, y: number, maxW: number, limitY: number) {
  const items = w.input.itinerary.highlights.slice(0, 5);
  if (!items.length || y + 22 > limitY) return;
  w.textAt('TRIP HIGHLIGHTS', x, y, { role: 'bodyBold', size: 8.2, color: w.p.primary, spacing: 1 });
  y += 7;
  for (const h of items) {
    const m = w.measure(h, maxW - 7, 'body', 10.2);
    if (y + m.h > limitY) break;
    w.fill(w.p.accent); w.doc.circle(x + 1.3, y + w.lh() / 2, 1.05, 'F');
    w.color(w.p.ink); w.doc.text(m.lines, x + 6, y, { baseline: 'top' });
    y += m.h + 1.8;
  }
}

function cover(w: Writer) {
  const { doc, W, H, M, d } = w;
  const p = d.palette;
  const it = w.input.itinerary;
  const ph = w.input.photos || {};
  const img = ph.cover || null;
  const facts = factChips(it);
  const kicker = pdfSafe(it.destination).toUpperCase();
  w.noChrome.add(1);
  w.paintPaper();

  switch (d.cover) {
    case 'hero': {
      if (img) w.photo(img, 0, 0, W, H);
      else { w.fill(p.dark); doc.rect(0, 0, W, H, 'F'); }
      // smooth scrim: overlapping translucent layers that all run to the page bottom (no seams)
      w.fill(p.dark);
      for (let i = 0; i < 36; i++) { w.alpha(0.028); doc.rect(0, H * 0.34 + i * (H * 0.6 / 36), W, H, 'F'); }
      w.alpha(1);
      w.logo(M, M, 22);
      let y = H * 0.55;
      w.fill(p.accent); doc.rect(M, y, 18, 1.6, 'F');
      y += 6;
      w.textAt(kicker, M, y, { role: 'bodyMedium', size: 9.5, color: WHITE, spacing: 1.2 });
      y += 8;
      y += coverTitle(w, it.title, M, y, W - M * 2, WHITE, 38) + 4;
      if (it.subtitle) y += w.textAt(it.subtitle, M, y, { role: 'headItalic', size: 13, color: mix(WHITE, p.dark, 0.1), maxW: W - M * 2 - 10 }) + 5;
      chips(w, facts, M, y, W - M * 2, WHITE, null, mix(WHITE, p.dark, 0.25));
      coverFooter(w, WHITE, mix(WHITE, p.dark, 0.3));
      return;
    }
    case 'split': {
      const px = W * 0.5;
      if (img) w.photo(img, px, 0, W - px, H);
      else { w.fill(p.primary); doc.rect(px, 0, W - px, H, 'F'); w.motif(d.motif === 'none' ? 'dots' : d.motif, px, H * 0.55, W - px, H * 0.45, WHITE, 0.25); }
      w.fill(p.paper); doc.rect(0, 0, px, H, 'F');
      w.logo(M, M, 20);
      let y = H * 0.3;
      w.textAt(kicker, M, y, { role: 'bodyMedium', size: 8.6, color: p.primary, spacing: 1.1, maxW: px - M - 8 });
      y += 9;
      y += coverTitle(w, it.title, M, y, px - M - 8, p.ink, 30) + 5;
      w.fill(p.primary); doc.rect(M, y, 14, 1.4, 'F');
      y += 7;
      if (it.subtitle) y += w.textAt(it.subtitle, M, y, { role: 'headItalic', size: 12, color: p.muted, maxW: px - M - 10 }) + 6;
      for (const f of facts) { w.textAt(f, M, y, { role: 'bodyMedium', size: 9.6, color: p.ink }); y += 6.4; }
      highlightsOnCover(w, M, y + 10, px - M - 8, H - M - 16);
      w.textAt(w.input.brand.companyName, M, H - M - 4, { role: 'bodyBold', size: 9.5, color: p.primary });
      return;
    }
    case 'arch': {
      w.fill(p.tint); doc.rect(0, 0, W, H, 'F');
      w.motif(['mountains', 'waves'].includes(d.motif) ? d.motif : 'mountains', 0, H * 0.84, W, H * 0.16, p.primary, 0.07);
      const aw = W * 0.56, ah = H * 0.44;
      const ax = (W - aw) / 2, ay = M + 24;
      if (img) w.photo(img, ax, ay, aw, ah, 'arch');
      else { w.fill(p.primary); w.archPath(ax, ay, aw, ah, null); doc.fill(); w.motif('sun', ax, ay, aw, ah * 0.7, WHITE, 0.2); }
      w.stroke(p.primary); doc.setLineWidth(0.4);
      w.archPath(ax - 3, ay - 3, aw + 6, ah + 6, 'S');
      w.logo((W - 18) / 2, M - 2, 18);
      let y = ay + ah + 12;
      w.textAt(kicker, W / 2, y, { role: 'bodyMedium', size: 8.6, color: p.primary, align: 'center', spacing: 1.4 });
      y += 8;
      y += coverTitle(w, it.title, M + 6, y, W - M * 2 - 12, p.ink, 30, 'center') + 4;
      if (it.subtitle) y += w.textAt(it.subtitle, W / 2, y, { role: 'headItalic', size: 12, color: p.muted, align: 'center', maxW: W - M * 2 - 20 }) + 4;
      w.textAt(facts.join('   ·   '), W / 2, y + 1, { role: 'body', size: 9.2, color: p.ink, align: 'center', maxW: W - M * 2 });
      coverFooter(w, p.primary, p.muted);
      return;
    }
    case 'collage': {
      const imgs = [img, ...(ph.gallery || [])].filter(Boolean) as Img[];
      const g = 2.5;
      const topH = H * 0.5;
      w.photo(imgs[0], 0, 0, W * 0.62, topH);
      w.photo(imgs[1] || imgs[0], W * 0.62 + g, 0, W * 0.38 - g, topH / 2 - g / 2);
      w.photo(imgs[2] || imgs[0], W * 0.62 + g, topH / 2 + g / 2, W * 0.38 - g, topH / 2 - g / 2);
      w.font('bodyBold', 8.4);
      const kw = Math.min(W - M * 2, w.doc.getTextWidth(w.t(kicker)) + 10 + kicker.length * 0.9);
      w.fill(p.primary); doc.rect(M, topH - 6, kw, 12, 'F');
      w.textAt(kicker, M + 5, topH - 2, { role: 'bodyBold', size: 8.4, color: WHITE, spacing: 0.9 });
      w.logo(W - M - 18, topH + 12, 18);
      let y = topH + 18;
      y += coverTitle(w, it.title, M, y, W - M * 2 - 24, p.ink, 32) + 5;
      if (it.subtitle) y += w.textAt(it.subtitle, M, y, { role: 'headItalic', size: 12.5, color: p.muted, maxW: W - M * 2 - 10 }) + 6;
      y = chips(w, facts, M, y, W - M * 2, p.primary, p.tint) + 12;
      highlightsOnCover(w, M, y, W - M * 2, H - M - 16);
      coverFooter(w, p.primary, p.muted);
      return;
    }
    case 'frame': {
      w.stroke(p.primary); doc.setLineWidth(0.7); doc.rect(10, 10, W - 20, H - 20);
      doc.setLineWidth(0.2); doc.rect(13, 13, W - 26, H - 26);
      w.motif('sun', W / 2 - 42, H * 0.1, 84, 84, p.primary, 0.08);
      const lh = w.logo((W - 24) / 2, H * 0.17, 24);
      let y = H * 0.17 + (lh || 0) + 14;
      w.textAt(kicker.split('').join(' '), W / 2, y, { role: 'body', size: 8.6, color: p.primary, align: 'center' });
      y += 9;
      y += coverTitle(w, it.title, M + 8, y, W - M * 2 - 16, p.ink, 32, 'center') + 5;
      w.stroke(p.primary); doc.setLineWidth(0.4); doc.line(W / 2 - 16, y, W / 2 + 16, y);
      y += 7;
      if (it.subtitle) y += w.textAt(it.subtitle, W / 2, y, { role: 'headItalic', size: 13, color: p.muted, align: 'center', maxW: W - M * 2 - 24 }) + 5;
      w.textAt(facts.join('   |   '), W / 2, y + 2, { role: 'body', size: 9.2, color: p.ink, align: 'center', maxW: W - M * 2 - 10 });
      if (img) w.photo(img, W / 2 - 36, H - 96, 72, 52, 'round', 2);
      const b = w.input.brand;
      w.textAt([b.companyName, b.website].filter(Boolean).join('  ·  '), W / 2, H - 30, { role: 'body', size: 8.6, color: p.muted, align: 'center' });
      return;
    }
    case 'type': {
      w.motif(d.motif === 'none' ? 'lines' : d.motif, W * 0.45, 0, W * 0.55, H * 0.3, p.primary, 0.09);
      w.logo(M, M, 18);
      const days = it.days.length;
      w.font('head', 150); w.color(mix(p.primary, p.paper, 0.86));
      doc.text(String(days).padStart(2, '0'), W - M + 4, H * 0.2, { baseline: 'top', align: 'right' });
      w.textAt(`${days} DAY${days === 1 ? '' : 'S'}  ·  ${kicker}`, M, H * 0.42, { role: 'bodyBold', size: 9, color: p.primary, spacing: 1.2, maxW: W - M * 2 });
      let y = H * 0.42 + 10;
      y += coverTitle(w, it.title, M, y, W - M * 2, p.ink, 40) + 6;
      w.fill(p.accent); doc.rect(M, y, 26, 2, 'F');
      y += 9;
      if (it.subtitle) y += w.textAt(it.subtitle, M, y, { role: 'headItalic', size: 14, color: p.muted, maxW: W - M * 2 - 20 }) + 8;
      y = chips(w, facts, M, y, W - M * 2, p.ink, null, mix(p.ink, p.paper, 0.75)) + 12;
      if (img) w.photo(img, M, H - M - 64, W - M * 2, 46, 'round', d.radius || 1);
      else highlightsOnCover(w, M, y, W - M * 2, H - M - 16);
      coverFooter(w, p.primary, p.muted);
      return;
    }
    case 'diagonal': {
      const topH = H * 0.58;
      w.fill(p.dark); doc.rect(0, 0, W, topH, 'F');
      if (img) { w.photo(img, 0, 0, W, topH); w.alpha(0.55); w.fill(p.dark); doc.rect(0, 0, W, topH, 'F'); w.alpha(1); }
      else w.motif(d.motif === 'none' ? 'mountains' : d.motif, 0, topH * 0.45, W, topH * 0.5, WHITE, 0.08);
      w.fill(p.primary); w.poly([[0, topH - 14], [W, topH - 58], [W, topH - 42], [0, topH + 2]]);
      w.fill(p.paper); w.poly([[0, topH + 2], [W, topH - 42], [W, H], [0, H]]);
      w.logo(M, M, 22);
      let y = topH * 0.32;
      w.textAt(kicker, M, y, { role: 'bodyBold', size: 9.5, color: p.primary === p.dark ? p.accent : mix(p.primary, WHITE, 0.3), spacing: 1.1 });
      y += 9;
      coverTitle(w, it.title, M, y, W - M * 2, WHITE, 36);
      y = topH + 14;
      if (it.subtitle) y += w.textAt(it.subtitle, M, y, { role: 'headItalic', size: 12.5, color: p.ink, maxW: W - M * 2 }) + 6;
      y = chips(w, facts, M, y, W - M * 2, p.ink, mix(p.primary, WHITE, 0.86)) + 12;
      highlightsOnCover(w, M, y, W - M * 2, H - M - 16);
      coverFooter(w, p.primary, p.muted);
      return;
    }
    default: { // band
      const bandH = H * 0.5;
      w.fill(p.primary); doc.rect(0, 0, W, bandH, 'F');
      if (img) { w.photo(img, 0, 0, W, bandH); w.alpha(0.5); w.fill(p.primary); doc.rect(0, 0, W, bandH, 'F'); w.alpha(1); }
      else w.motif(d.motif === 'none' ? 'sun' : d.motif, W * 0.4, bandH * 0.12, W * 0.6, bandH * 0.88, WHITE, 0.15);
      w.logo(M, M, 22);
      let y = bandH * 0.44;
      w.textAt(kicker, M, y, { role: 'bodyMedium', size: 9.5, color: mix(WHITE, p.primary, 0.2), spacing: 1.1 });
      y += 9;
      coverTitle(w, it.title, M, y, W - M * 2, WHITE, 34);
      y = bandH + 14;
      if (it.subtitle) y += w.textAt(it.subtitle, M, y, { role: 'headItalic', size: 13, color: p.ink, maxW: W - M * 2 }) + 6;
      y = chips(w, facts, M, y, W - M * 2, p.primary, p.tint) + 10;
      if (it.overview) {
        w.font('body', 10.2);
        const ol = w.split(it.overview, W - M * 2).slice(0, 6);
        w.color(p.muted); doc.text(ol, M, y, { baseline: 'top' });
        y += ol.length * w.lh() + 10;
      }
      highlightsOnCover(w, M, y, W - M * 2, H - M - 16);
      coverFooter(w, p.primary, p.muted);
    }
  }
}

/* ═══════════════════════════════ sections ═══════════════════════════════ */

function sectionTitle(w: Writer, label: string, kicker?: string) {
  const { doc, M, d } = w;
  const p = d.palette;
  w.sectionNo++;
  // keep the heading with at least the start of its content (no stranded headings)
  w.ensure(48);
  w.gap(5);
  const title = w.upper(w.t(label));
  switch (d.section) {
    case 'numbered': {
      w.font('head', 26); w.color(p.primary);
      const n = String(w.sectionNo).padStart(2, '0');
      doc.text(n, M, w.y, { baseline: 'top' });
      const nw = doc.getTextWidth(n) + 4;
      w.font('head', 17); w.color(p.ink);
      doc.text(title, M + nw, w.y + 3.4, { baseline: 'top' });
      w.y += 13.5;
      w.stroke(p.ink); doc.setLineWidth(0.45); doc.line(M, w.y, w.W - M, w.y);
      w.y += 6;
      return;
    }
    case 'centered': {
      w.font('head', 18); w.color(p.ink);
      doc.text(title, w.W / 2, w.y, { baseline: 'top', align: 'center' });
      const tw = doc.getTextWidth(title);
      const my = w.y + w.lh() / 2;
      w.stroke(p.primary); doc.setLineWidth(0.3);
      doc.line(M + 6, my, w.W / 2 - tw / 2 - 8, my);
      doc.line(w.W / 2 + tw / 2 + 8, my, w.W - M - 6, my);
      w.fill(p.primary); doc.circle(w.W / 2 - tw / 2 - 5, my, 0.7, 'F'); doc.circle(w.W / 2 + tw / 2 + 5, my, 0.7, 'F');
      w.y += w.lh() + 6;
      return;
    }
    case 'rule': {
      w.font('head', 16.5); w.color(p.ink);
      doc.text(title, M, w.y, { baseline: 'top' });
      w.y += w.lh() + 1.5;
      w.stroke(mix(p.ink, p.paper, 0.82)); doc.setLineWidth(0.3); doc.line(M, w.y, w.W - M, w.y);
      w.fill(p.primary); doc.rect(M, w.y - 0.5, 16, 1, 'F');
      w.y += 6;
      return;
    }
    case 'overline': {
      w.textAt((kicker || `Part ${w.sectionNo}`).toUpperCase(), M, w.y, { role: 'bodyBold', size: 7.8, color: p.primary, spacing: 1.2 });
      w.y += 5;
      w.font('head', 18.5); w.color(p.ink);
      doc.text(title, M, w.y, { baseline: 'top' });
      w.y += w.lh() + 4;
      return;
    }
    default: { // bar
      w.fill(p.primary); doc.roundedRect(M, w.y + 0.6, 1.8, 8, 0.9, 0.9, 'F');
      w.fill(p.accent); doc.roundedRect(M, w.y + 0.6, 1.8, 2.6, 0.9, 0.9, 'F');
      w.font('head', 17); w.color(p.ink);
      doc.text(title, M + 5.5, w.y, { baseline: 'top' });
      w.y += 13;
    }
  }
}

function glance(w: Writer, it: Itinerary) {
  const p = w.p;
  const stats: [string, string][] = [];
  if (it.days.length) stats.push([String(it.days.length), it.days.length === 1 ? 'Day' : 'Days']);
  const nights = /(\d+)\s*Night/i.exec(it.durationLabel || '')?.[1];
  if (nights) stats.push([nights, Number(nights) === 1 ? 'Night' : 'Nights']);
  if (it.travellers && /^\d+$/.test(it.travellers)) stats.push([it.travellers, 'Travellers']);
  const pr = it.pricing.find((x) => x.amount != null);
  if (pr) stats.push([`₹${Number(pr.amount).toLocaleString('en-IN')}`, pr.basis || pr.label]);
  if (stats.length >= 2) {
    const cw = w.cw / stats.length;
    w.ensure(26);
    stats.forEach(([v, l], i) => {
      const x = w.M + i * cw + (i > 0 ? 5 : 0);
      const money = v.includes('₹');
      w.font(money ? 'bodyBold' : 'head', money ? 21 : 30);
      w.color(p.primary);
      w.doc.text(w.t(v), x, w.y + (money ? 2 : 0), { baseline: 'top' });
      w.textAt(l.toUpperCase(), x, w.y + 13.5, { role: 'bodyMedium', size: 7.4, color: p.muted, spacing: 0.8, maxW: cw - 8 });
      if (i > 0) { w.stroke(mix(p.ink, p.paper, 0.85)); w.doc.setLineWidth(0.3); w.doc.line(x - 5, w.y + 1, x - 5, w.y + 19); }
    });
    w.y += 26;
  }
  const facts = ([['Destination', it.destination], ['Dates', it.dates || 'Flexible'], ['Starts from', it.startLocation], ['Ends at', it.endLocation], ['Ideal for', it.audience], ['Pickup', it.pickup], ['Drop', it.drop]] as [string, string | undefined][])
    .filter(([, v]) => v) as [string, string][];
  if (facts.length) {
    const colW = (w.cw - 10) / 2;
    for (let i = 0; i < facts.length; i += 2) {
      const row = facts.slice(i, i + 2);
      const h = Math.max(...row.map(([, v]) => w.measure(v, colW - 32, 'bodyMedium', 9.6).h)) + 4.5;
      w.ensure(h);
      row.forEach(([k, v], j) => {
        const x = w.M + j * (colW + 10);
        w.textAt(k.toUpperCase(), x, w.y + 0.9, { role: 'bodyMedium', size: 7.2, color: p.muted, spacing: 0.6 });
        w.textAt(v, x + 30, w.y, { role: 'bodyMedium', size: 9.6, color: p.ink, maxW: colW - 32 });
      });
      w.y += h;
      w.stroke(mix(p.ink, p.paper, 0.9)); w.doc.setLineWidth(0.2); w.doc.line(w.M, w.y - 1.8, w.W - w.M, w.y - 1.8);
    }
    w.gap(5);
  }
  if (it.overview) {
    const m = w.measure(it.overview, w.cw - 10, 'headItalic', 12.5);
    if (m.h < (w.bottom - w.top) * 0.6) {
      w.ensure(m.h + 6);
      w.fill(p.accent); w.doc.rect(w.M, w.y + 0.5, 1.3, m.h - 1, 'F');
      w.color(p.ink); w.doc.text(m.lines, w.M + 7, w.y, { baseline: 'top' });
      w.y += m.h + 6;
    } else w.para(it.overview, { size: 10.5 });
  }
}

type IconKind = 'dot' | 'check' | 'cross' | 'num';

function icon(w: Writer, kind: IconKind, cx: number, cy: number, color: string, n = 0) {
  const { doc } = w;
  if (kind === 'dot') { w.fill(color); doc.circle(cx, cy, 1, 'F'); return; }
  if (kind === 'num') {
    w.fill(mix(color, w.p.paper, 0.86)); doc.circle(cx + 0.6, cy, 2.7, 'F');
    w.textAt(String(n), cx + 0.6, cy - 1.75, { role: 'bodyBold', size: 7, color, align: 'center' });
    return;
  }
  w.fill(mix(color, w.p.paper, 0.86)); doc.circle(cx, cy, 2.2, 'F');
  w.stroke(color); doc.setLineWidth(0.5);
  if (kind === 'check') { doc.line(cx - 1, cy, cx - 0.25, cy + 0.8); doc.line(cx - 0.25, cy + 0.8, cx + 1.1, cy - 0.85); }
  else { doc.line(cx - 0.8, cy - 0.8, cx + 0.8, cy + 0.8); doc.line(cx + 0.8, cy - 0.8, cx - 0.8, cy + 0.8); }
}

function bullets(w: Writer, items: string[], o: { icon?: IconKind; color?: string; size?: number } = {}) {
  items.forEach((item, idx) => {
    const m = w.measure(item, w.cw - 8, 'body', o.size || 10);
    w.ensure(Math.min(m.h, w.lh() * 3) + 2);
    icon(w, o.icon || 'dot', w.M + 1.8, w.y + w.lh() / 2, o.color || w.p.primary, idx + 1);
    w.font('body', o.size || 10); w.color(w.p.ink);
    for (const line of m.lines) { w.ensure(w.lh()); w.doc.text(line, w.M + 7.5, w.y, { baseline: 'top' }); w.y += w.lh(); }
    w.y += 2 * w.k;
  });
}

function tag(w: Writer, text: string, x: number, y: number, color: string | RGB, filled = false) {
  w.font('bodyBold', 6.6);
  const label = w.t(text);
  const tw = w.doc.getTextWidth(label) + 4.4;
  const h = 3.8;
  if (filled) { w.fill(color); w.doc.roundedRect(x, y, tw, h, 1.2, 1.2, 'F'); w.color(WHITE); }
  else { w.stroke(color); w.doc.setLineWidth(0.25); w.doc.roundedRect(x, y, tw, h, 1.2, 1.2, 'S'); w.color(color); }
  w.doc.text(label, x + 2.2, y + h / 2 + 0.15, { baseline: 'middle' });
  return tw;
}

/* ═══════════════════════════════ days ═══════════════════════════════ */

function dayInfoLine(d: ItineraryDay) {
  return [d.meals?.length ? `Meals: ${d.meals.join(', ')}` : '', d.stay ? `Stay: ${d.stay}` : '', d.transport ? `Travel: ${d.transport}` : ''].filter(Boolean).join('   ·   ');
}

function activities(w: Writer, d: ItineraryDay, x: number, width: number, style: 'timeline' | 'list') {
  const p = w.p;
  const acts = d.activities || [];
  acts.forEach((a, i) => {
    let timeW = 0;
    if (a.time) { w.font('bodyBold', 9.6); timeW = w.doc.getTextWidth(w.t(a.time)) + 3; }
    const hm = w.measure(a.title, width - timeW - 22, 'bodyMedium', 10);
    const dm = a.description ? w.measure(a.description, width - 2, 'body', 9.2) : null;
    const h = hm.h + (dm ? dm.h + 0.6 : 0) + 3 * w.k;
    w.ensure(Math.min(h, w.bottom - w.top));
    if (style === 'timeline') {
      const dotX = x - 6;
      w.fill(i === 0 ? p.primary : mix(p.primary, p.paper, 0.4)); w.doc.circle(dotX, w.y + 2.3, 1.25, 'F');
      if (i < acts.length - 1) { w.stroke(mix(p.primary, p.paper, 0.72)); w.doc.setLineWidth(0.4); w.doc.line(dotX, w.y + 4.2, dotX, w.y + h + 0.6); }
    } else {
      w.fill(p.accent); w.doc.rect(x - 4.5, w.y + 1.6, 1.4, 1.4, 'F');
    }
    let tx = x;
    if (a.time) { w.textAt(a.time, tx, w.y, { role: 'bodyBold', size: 9.6, color: p.primary }); tx += timeW; }
    w.font('bodyMedium', 10); w.color(p.ink);
    w.doc.text(hm.lines, tx, w.y, { baseline: 'top' });
    if (a.status !== 'included') {
      w.font('bodyMedium', 10);
      const lw = w.doc.getTextWidth(hm.lines[hm.lines.length - 1] || '');
      tag(w, a.status === 'optional' ? 'OPTIONAL' : 'SUGGESTED', Math.min(tx + lw + 2.5, x + width - 18), w.y + (hm.lines.length - 1) * w.lh() + 0.3, a.status === 'optional' ? '#B45309' : p.muted);
    }
    w.y += hm.h;
    if (dm) {
      w.y += 0.6;
      w.font('body', 9.2); w.color(p.muted);
      for (const line of dm.lines) { w.ensure(w.lh()); w.doc.text(line, x, w.y, { baseline: 'top' }); w.y += w.lh(); }
    }
    w.y += 3 * w.k;
  });
}

function infoBox(w: Writer, info: string, x: number, width: number) {
  const m = w.measure(info, width - 8, 'body', 8.8);
  w.ensure(m.h + 5);
  w.fill(w.p.tint); w.doc.roundedRect(x, w.y, width, m.h + 4.5, Math.min(w.d.radius, 2), Math.min(w.d.radius, 2), 'F');
  w.color(w.p.ink); w.doc.text(m.lines, x + 4, w.y + 2.3, { baseline: 'top' });
  w.y += m.h + 6.5;
}

function dayBlock(w: Writer, d: ItineraryDay, style: DayStyle, img: Img | null, idx: number) {
  const { doc, M } = w;
  const p = w.p;
  const R = w.d.radius;
  const info = dayInfoLine(d);
  const meta = [d.date, d.route].filter(Boolean).join('   ·   ');

  if (img && style !== 'magazine') {
    const ph = Math.min(54, (w.bottom - w.top) * 0.28);
    w.ensure(ph + 36);
    w.photo(img, M, w.y, w.cw, ph, R > 0 ? 'round' : 'rect', R);
    w.y += ph + 5;
  }

  if (style === 'magazine') {
    const colW = 34;
    const x = M + colW + 6;
    const width = w.W - M - x;
    const tm = w.measure(w.upper(d.title), width, 'head', 16);
    w.ensure(Math.max(tm.h + 22, img ? 74 : 40));
    const top = w.y;
    const startPage = doc.getNumberOfPages();
    w.textAt('DAY', M + 1, w.y, { role: 'bodyBold', size: 7.6, color: p.muted, spacing: 1.4 });
    w.font('head', 50); w.color(mix(p.primary, p.paper, 0.12));
    doc.text(String(d.day).padStart(2, '0'), M - 1, w.y + 3, { baseline: 'top' });
    if (img) w.photo(img, M, w.y + 27, colW, 44, R ? 'round' : 'rect', R);
    w.font('head', 16); w.color(p.ink);
    doc.text(tm.lines, x, w.y, { baseline: 'top' });
    w.y += tm.h + 1;
    if (meta) w.y += w.textAt(meta, x, w.y, { role: 'bodyMedium', size: 9, color: p.primary, maxW: width }) + 1.5;
    if (d.summary) { w.y += 1; w.para(d.summary, { x, width, size: 10, color: p.muted, after: 2.5 }); }
    activities(w, d, x + 4.5, width - 4.5, 'list');
    if (info) w.para(info, { x, width, size: 8.8, color: p.ink, after: 1 });
    if (d.notes) w.para(`Note: ${d.notes}`, { x, width, size: 8.8, role: 'bodyItalic', color: p.muted, after: 1 });
    if (doc.getNumberOfPages() === startPage) w.y = Math.max(w.y, top + (img ? 76 : 30));
    w.gap(5);
    w.stroke(mix(p.ink, p.paper, 0.88)); doc.setLineWidth(0.25); doc.line(M, w.y - 2.5, w.W - M, w.y - 2.5);
    w.gap(2);
    return;
  }

  if (style === 'cards') {
    const x = M + 6;
    const width = w.cw - 12;
    const tm = w.measure(w.upper(d.title), width - 30, 'head', 14.5);
    w.ensure(tm.h + 34);
    const startPage = doc.getNumberOfPages();
    const top = w.y;
    w.fill(idx % 2 === 0 ? p.primary : p.dark);
    doc.roundedRect(M, w.y, w.cw, tm.h + 9, R, R, 'F');
    if (R) doc.rect(M, w.y + tm.h + 9 - R, w.cw, R, 'F');
    w.textAt(`DAY ${String(d.day).padStart(2, '0')}`, M + 6, w.y + 4.6, { role: 'bodyBold', size: 8, color: mix(WHITE, p.primary, 0.25), spacing: 1.2 });
    w.font('head', 14.5); w.color(WHITE);
    doc.text(tm.lines, x + 24, w.y + 3.4, { baseline: 'top' });
    w.y += tm.h + 14;
    if (meta) w.y += w.textAt(meta, x, w.y, { role: 'bodyMedium', size: 9, color: p.primary, maxW: width }) + 1.5;
    if (d.summary) w.para(d.summary, { x, width, size: 10, color: p.muted, after: 2.5 });
    activities(w, d, x + 6, width - 6, 'timeline');
    if (info) infoBox(w, info, x, width);
    if (d.notes) w.para(`Note: ${d.notes}`, { x, width, size: 8.8, role: 'bodyItalic', color: p.muted, after: 1 });
    if (doc.getNumberOfPages() === startPage) {
      w.stroke(mix(p.ink, p.paper, 0.85)); doc.setLineWidth(0.3);
      doc.roundedRect(M, top, w.cw, w.y - top + 2, R, R, 'S');
    }
    w.gap(9);
    return;
  }

  if (style === 'ledger') {
    const labelW = 27;
    const x = M + labelW;
    const width = w.cw - labelW;
    const tm = w.measure(w.upper(d.title), width, 'head', 13.5);
    w.ensure(tm.h + 24);
    w.stroke(p.primary); doc.setLineWidth(0.6); doc.line(M, w.y, w.W - M, w.y);
    w.y += 4;
    w.textAt(`DAY ${d.day}`, M, w.y + 0.6, { role: 'bodyBold', size: 9, color: p.primary, spacing: 1 });
    if (d.date) w.textAt(d.date, M, w.y + 5.8, { role: 'body', size: 7.6, color: p.muted, maxW: labelW - 3 });
    w.font('head', 13.5); w.color(p.ink);
    doc.text(tm.lines, x, w.y, { baseline: 'top' });
    w.y += tm.h + 1;
    if (d.route) w.y += w.textAt(d.route, x, w.y, { role: 'bodyMedium', size: 8.8, color: p.primary, maxW: width }) + 1.5;
    if (d.summary) w.para(d.summary, { x, width, size: 9.8, color: p.muted, after: 2 });
    activities(w, d, x + 4.5, width - 4.5, 'list');
    if (info) w.para(info, { x, width, size: 8.6, color: p.ink, after: 1 });
    if (d.notes) w.para(`Note: ${d.notes}`, { x, width, size: 8.6, role: 'bodyItalic', color: p.muted, after: 1 });
    w.gap(5);
    return;
  }

  // timeline
  const badge = 15;
  const x = M + badge + 7;
  const width = w.W - M - x;
  const tm = w.measure(w.upper(d.title), width, 'head', 14);
  w.ensure(Math.max(badge + 8, tm.h + 18));
  const top = w.y;
  if (w.d.mood === 'elegant' || w.d.mood === 'minimal') {
    w.stroke(p.primary); doc.setLineWidth(0.45); doc.circle(M + badge / 2, w.y + badge / 2, badge / 2, 'S');
    w.textAt('DAY', M + badge / 2, w.y + 3.6, { role: 'bodyMedium', size: 6.2, color: p.primary, align: 'center' });
    w.textAt(String(d.day), M + badge / 2, w.y + 6.6, { role: 'bodyBold', size: 12, color: p.ink, align: 'center' });
  } else {
    w.fill(p.primary); doc.roundedRect(M, w.y, badge, badge, Math.max(R, 1.5), Math.max(R, 1.5), 'F');
    w.textAt('DAY', M + badge / 2, w.y + 2.6, { role: 'bodyBold', size: 6.2, color: mix(WHITE, p.primary, 0.25), align: 'center' });
    w.textAt(String(d.day), M + badge / 2, w.y + 5.8, { role: 'bodyBold', size: 13, color: WHITE, align: 'center' });
  }
  w.font('head', 14); w.color(p.ink);
  doc.text(tm.lines, x, w.y, { baseline: 'top' });
  w.y += tm.h;
  if (meta) w.y += w.textAt(meta, x, w.y + 0.8, { role: 'bodyMedium', size: 8.8, color: p.primary, maxW: width }) + 1.6;
  w.y = Math.max(w.y + 2, top + 2);
  if (d.summary) w.para(d.summary, { x, width, size: 10, color: p.muted, after: 2.5 });
  activities(w, d, x, width, 'timeline');
  if (info) infoBox(w, info, x, width);
  if (d.notes) w.para(`Note: ${d.notes}`, { x, width, size: 8.8, role: 'bodyItalic', color: p.muted, after: 1 });
  w.gap(6);
}

/* ═══════════════════════════════ other sections ═══════════════════════════════ */

function cardRows(w: Writer, rows: { title: string; lines: string[]; badge?: { text: string; color: string; filled?: boolean } }[]) {
  const p = w.p;
  const R = w.d.radius;
  for (const r of rows) {
    const tm = w.measure(r.title, w.cw - 44, 'bodyBold', 10.4);
    const lm = r.lines.length ? w.measure(r.lines.join('\n'), w.cw - 12, 'body', 9.2) : null;
    const h = tm.h + (lm ? lm.h + 0.8 : 0) + 8;
    w.ensure(h);
    w.fill(p.tint); w.doc.roundedRect(w.M, w.y, w.cw, h, R, R, 'F');
    w.fill(p.primary); w.doc.rect(w.M, w.y + 2.5, 1.2, h - 5, 'F');
    w.font('bodyBold', 10.4); w.color(p.ink); w.doc.text(tm.lines, w.M + 6, w.y + 4, { baseline: 'top' });
    if (r.badge) { w.font('bodyBold', 6.6); tag(w, r.badge.text, w.W - w.M - 6 - (w.doc.getTextWidth(w.t(r.badge.text)) + 4.4), w.y + 4, r.badge.color, r.badge.filled); }
    if (lm) { w.font('body', 9.2); w.color(p.muted); w.doc.text(lm.lines, w.M + 6, w.y + 4 + tm.h + 0.8, { baseline: 'top' }); }
    w.y += h + 3;
  }
  w.gap(1);
}

function twoLists(w: Writer, a: string[], b: string[]) {
  const p = w.p;
  const G = '#15803D', Rd = '#B91C1C';
  if (!a.length || !b.length) {
    if (a.length) { w.textAt('Included', w.M, w.y, { role: 'bodyBold', size: 10, color: G }); w.y += 7; bullets(w, a, { icon: 'check', color: G }); }
    if (b.length) { w.textAt('Not included', w.M, w.y, { role: 'bodyBold', size: 10, color: Rd }); w.y += 7; bullets(w, b, { icon: 'cross', color: Rd }); }
    return;
  }
  const gap = 10;
  const cw = (w.cw - gap) / 2;
  w.ensure(16);
  w.textAt('Included', w.M, w.y, { role: 'bodyBold', size: 10, color: G });
  w.textAt('Not included', w.M + cw + gap, w.y, { role: 'bodyBold', size: 10, color: Rd });
  w.y += 7.5;
  const rows = Math.max(a.length, b.length);
  for (let i = 0; i < rows; i++) {
    const ma = a[i] ? w.measure(a[i], cw - 8, 'body', 9.8) : null;
    const mb = b[i] ? w.measure(b[i], cw - 8, 'body', 9.8) : null;
    const h = Math.max(ma?.h || 0, mb?.h || 0) + 2.4 * w.k;
    w.ensure(h);
    for (const [m, x, kind, c] of [[ma, w.M, 'check', G], [mb, w.M + cw + gap, 'cross', Rd]] as const) {
      if (!m) continue;
      icon(w, kind, x + 1.8, w.y + w.lh() / 2, c);
      w.font('body', 9.8); w.color(p.ink); w.doc.text(m.lines, x + 7.5, w.y, { baseline: 'top' });
    }
    w.y += h;
  }
  w.gap(2);
}

function priceCard(w: Writer, it: Itinerary) {
  const p = w.p;
  const R = w.d.radius;
  const rows = it.pricing;
  if (rows.length) {
    const [main, ...rest] = rows;
    const noteH = main.note ? w.measure(main.note, w.cw - 80, 'body', 8.4).h : 0;
    const h = 30 + noteH + rest.length * 8;
    w.ensure(h + 6);
    w.fill(p.dark); w.doc.roundedRect(w.M, w.y, w.cw, h, R, R, 'F');
    w.motif(w.d.motif === 'none' ? 'dots' : w.d.motif, w.W - w.M - 70, w.y, 70, h, WHITE, 0.08);
    w.textAt(main.label.toUpperCase(), w.M + 8, w.y + 6, { role: 'bodyBold', size: 8, color: mix(WHITE, p.dark, 0.35), spacing: 1 });
    const amount = main.amount != null ? `₹${Number(main.amount).toLocaleString('en-IN')}` : 'On request';
    w.font('bodyBold', 26); w.color(WHITE);
    w.doc.text(w.t(amount), w.M + 8, w.y + 11, { baseline: 'top' });
    const aw = w.doc.getTextWidth(w.t(amount));
    if (main.basis) w.textAt(main.basis, w.M + 11 + aw, w.y + 18.6, { role: 'body', size: 9.6, color: mix(WHITE, p.dark, 0.3) });
    if (main.note) w.textAt(main.note, w.M + 8, w.y + 25, { role: 'body', size: 8.4, color: mix(WHITE, p.dark, 0.35), maxW: w.cw - 80 });
    let y = w.y + 28 + noteH;
    for (const r of rest) {
      w.textAt(`${r.label}${r.basis ? ` (${r.basis})` : ''}`, w.M + 8, y, { role: 'body', size: 9.4, color: WHITE });
      w.textAt(r.amount != null ? `₹${Number(r.amount).toLocaleString('en-IN')}` : 'On request', w.W - w.M - 8, y, { role: 'bodyBold', size: 9.6, color: WHITE, align: 'right' });
      y += 8;
    }
    w.y += h + 5;
  }
  if (it.pricingNote) w.para(it.pricingNote, { size: 9.2, role: 'bodyItalic', color: p.muted });
}

function gallery(w: Writer, imgs: Img[]) {
  const R = w.d.radius;
  const shape = R > 0 ? 'round' : 'rect';
  if (w.bottom - w.y < 120) w.newPage();
  sectionTitle(w, 'Glimpses', 'Gallery');
  const g = 3;
  const y = w.y;
  const H = Math.min(w.bottom - w.y - 4, w.cw * 0.8);
  if (imgs.length === 2) {
    w.photo(imgs[0], w.M, y, w.cw * 0.58 - g / 2, H * 0.72, shape, R);
    w.photo(imgs[1], w.M + w.cw * 0.58 + g / 2, y + H * 0.22, w.cw * 0.42 - g / 2, H * 0.72, shape, R);
    w.y = y + H * 0.94 + 4;
  } else if (imgs.length === 3) {
    w.photo(imgs[0], w.M, y, w.cw, H * 0.55, shape, R);
    w.photo(imgs[1], w.M, y + H * 0.55 + g, w.cw / 2 - g / 2, H * 0.45 - g, shape, R);
    w.photo(imgs[2], w.M + w.cw / 2 + g / 2, y + H * 0.55 + g, w.cw / 2 - g / 2, H * 0.45 - g, shape, R);
    w.y = y + H + 4;
  } else {
    const list = imgs.slice(0, 6);
    const rows = Math.ceil(list.length / 2);
    const ch = (H - g * (rows - 1)) / rows;
    list.forEach((im, i) => {
      const r = Math.floor(i / 2), c = i % 2;
      const wide = list.length % 2 === 1 && i === list.length - 1;
      w.photo(im, w.M + (wide ? 0 : c * (w.cw / 2 + g / 2)), y + r * (ch + g), wide ? w.cw : w.cw / 2 - g / 2, ch, shape, R);
    });
    w.y = y + H + 4;
  }
}

function backCover(w: Writer, it: Itinerary) {
  const { doc, W, H, M } = w;
  const p = w.p;
  const b = w.input.brand;
  w.newPage({ chrome: false });
  w.fill(p.dark); doc.rect(0, 0, W, H, 'F');
  w.motif(w.d.motif === 'none' ? 'mountains' : w.d.motif, 0, H * 0.64, W, H * 0.36, WHITE, 0.06);
  if (w.input.logo) { w.fill(WHITE); doc.circle(W / 2, H * 0.16 + 15, 17.5, 'F'); }
  const lh = w.logo((W - 30) / 2, H * 0.16, 30);
  let y = H * 0.16 + (lh || 0) + 12;
  w.textAt(b.companyName, W / 2, y, { role: 'head', size: 26, color: WHITE, align: 'center' });
  y += 13;
  if (b.tagline) { w.textAt(b.tagline, W / 2, y, { role: 'headItalic', size: 13, color: mix(WHITE, p.dark, 0.3), align: 'center' }); y += 10; }
  w.fill(p.accent); doc.rect(W / 2 - 10, y, 20, 1.2, 'F');
  y += 12;
  w.textAt('READY TO GO?', W / 2, y, { role: 'bodyBold', size: 8.6, color: mix(p.accent, WHITE, 0.3), align: 'center', spacing: 1.6 });
  y += 8;
  const cta = b.contactPerson ? `Talk to ${b.contactPerson} to book “${pdfSafe(it.title)}”.` : `Get in touch to book “${pdfSafe(it.title)}”.`;
  y += w.textAt(cta, W / 2, y, { role: 'body', size: 11, color: WHITE, align: 'center', maxW: W - M * 4 }) + 10;
  const rows = ([['Contact', b.contactPerson], ['Phone', b.phone], ['WhatsApp', b.whatsapp], ['Email', b.email], ['Website', b.website], ['Instagram', b.instagram], ['Office', b.address]] as [string, string | undefined][])
    .filter(([, v]) => v) as [string, string][];
  if (rows.length) {
    const boxW = Math.min(132, W - M * 2);
    const bx = (W - boxW) / 2;
    const boxH = rows.length * 9 + 8;
    w.alpha(0.09); w.fill(WHITE); doc.roundedRect(bx, y, boxW, boxH, 3, 3, 'F'); w.alpha(1);
    let ry = y + 5;
    for (const [k, v] of rows) {
      w.textAt(k.toUpperCase(), bx + 8, ry + 0.9, { role: 'bodyMedium', size: 7.2, color: mix(WHITE, p.dark, 0.4), spacing: 0.8 });
      w.textAt(v, bx + 36, ry, { role: 'bodyMedium', size: 10, color: WHITE, maxW: boxW - 44 });
      ry += 9;
    }
  }
  w.textAt('Hotels, transport and prices are subject to availability at the time of booking unless marked confirmed.', W / 2, H - M - 6, { role: 'body', size: 7.4, color: mix(WHITE, p.dark, 0.5), align: 'center', maxW: W - M * 2 });
}

/* ═══════════════════════════════ chrome ═══════════════════════════════ */

function stampChrome(w: Writer) {
  const { doc, W, H, M } = w;
  const p = w.p;
  const n = doc.getNumberOfPages();
  const b = w.input.brand;
  const title = pdfSafe(w.input.itinerary.title);
  for (let i = 1; i <= n; i++) {
    if (w.noChrome.has(i)) continue;
    doc.setPage(i);
    if (w.o.header !== false) {
      const lg = w.logo(M, M - 3.6, 7.5);
      w.textAt(b.companyName.toUpperCase(), M + (lg ? 9.5 : 0), M - 1, { role: 'bodyBold', size: 7.4, color: p.primary, spacing: 0.8 });
      w.font('body', 7.4);
      const tt = (doc.splitTextToSize(w.t(title), W / 2) as string[])[0] || '';
      w.textAt(tt, W - M, M - 1, { role: 'body', size: 7.4, color: p.muted, align: 'right' });
      w.stroke(mix(p.ink, p.paper, 0.86)); doc.setLineWidth(0.2); doc.line(M, M + 4.6, W - M, M + 4.6);
    }
    if (w.o.footer !== false) {
      const left = w.o.footerText || [b.contactPerson, b.phone, b.website].filter(Boolean).join('   ·   ');
      w.stroke(mix(p.ink, p.paper, 0.86)); doc.setLineWidth(0.2); doc.line(M, H - M - 1, W - M, H - M - 1);
      if (left) w.textAt(left, M, H - M + 1, { role: 'body', size: 7.4, color: p.muted });
      w.textAt(`${String(i).padStart(2, '0')} / ${String(n).padStart(2, '0')}`, W - M, H - M + 1, { role: 'bodyMedium', size: 7.4, color: p.muted, align: 'right' });
    }
  }
}

/* ═══════════════════════════════ entry ═══════════════════════════════ */

export function renderItineraryPdf(input: RenderInput): { buffer: Buffer; pageCount: number } {
  const w = new Writer(input);
  const it = input.itinerary;
  const o = input.options;
  const show = (k: SectionKey) => o.sections?.[k] !== false;
  const photos = input.photos || {};

  if ((o.cover || 'full') === 'full') {
    cover(w);
    w.newPage();
  } else {
    w.paintPaper();
    const lh = w.logo(w.M, w.top - 4, 16);
    w.y = w.top + (lh ? 16 : 2);
    w.textAt(pdfSafe(it.destination).toUpperCase(), w.M, w.y, { role: 'bodyBold', size: 8.4, color: w.p.primary, spacing: 1 });
    w.y += 7;
    w.y += coverTitle(w, it.title, w.M, w.y, w.cw, w.p.ink, 26) + 4;
    if (it.subtitle) w.para(it.subtitle, { role: 'headItalic', size: 12, color: w.p.muted, after: 4 });
  }

  if (show('overview')) { sectionTitle(w, 'At a glance', 'Overview'); glance(w, it); }
  const highlightsOnCoverAlready = (o.cover || 'full') === 'full' && ['band', 'diagonal'].includes(w.d.cover);
  if (show('highlights') && it.highlights.length && !highlightsOnCoverAlready) {
    sectionTitle(w, SECTION_LABELS.highlights, 'Why go');
    bullets(w, it.highlights, { icon: 'num' });
  }
  if (show('days') && it.days.length) {
    if (w.bottom - w.y < (w.bottom - w.top) * 0.3) w.newPage();
    sectionTitle(w, SECTION_LABELS.days, 'The plan');
    it.days.forEach((d, i) => dayBlock(w, d, w.d.dayStyles[i % w.d.dayStyles.length], photos.days?.[d.day] || null, i));
  }
  if (show('stays') && it.stays.length) {
    sectionTitle(w, SECTION_LABELS.stays, 'Where you stay');
    cardRows(w, it.stays.map((s) => ({
      title: [s.location, s.name || s.category].filter(Boolean).join(' — ') || 'Accommodation',
      lines: [s.name && s.category ? s.category : '', s.nights ? `Nights: ${s.nights}` : '', s.notes || ''].filter(Boolean),
      badge: s.confirmed ? { text: 'CONFIRMED', color: '#15803D', filled: true } : { text: 'OR SIMILAR', color: w.p.muted },
    })));
  }
  if (show('transport') && it.transport.length) {
    sectionTitle(w, SECTION_LABELS.transport, 'Getting around');
    cardRows(w, it.transport.map((t) => ({ title: t.mode, lines: t.details ? [t.details] : [], badge: t.confirmed ? { text: 'CONFIRMED', color: '#15803D', filled: true } : undefined })));
  }
  if (show('inclusions') && (it.inclusions.length || it.exclusions.length)) { sectionTitle(w, SECTION_LABELS.inclusions, 'What’s covered'); twoLists(w, it.inclusions, it.exclusions); }
  if (show('pricing') && (it.pricing.length || it.pricingNote)) { sectionTitle(w, SECTION_LABELS.pricing, 'Investment'); priceCard(w, it); }
  if (show('payment') && it.paymentTerms.length) { sectionTitle(w, SECTION_LABELS.payment, 'Booking'); bullets(w, it.paymentTerms, { icon: 'num' }); }
  if (show('cancellation') && it.cancellationPolicy.length) { sectionTitle(w, SECTION_LABELS.cancellation, 'Policy'); bullets(w, it.cancellationPolicy); }
  if (show('notes') && it.importantNotes.length) { sectionTitle(w, SECTION_LABELS.notes, 'Good to know'); bullets(w, it.importantNotes); }
  if (show('carry') && it.thingsToCarry.length) {
    sectionTitle(w, SECTION_LABELS.carry, 'Packing');
    if (it.thingsToCarry.length > 6) {
      const gap = 10, cw = (w.cw - gap) / 2;
      const half = Math.ceil(it.thingsToCarry.length / 2);
      const a = it.thingsToCarry.slice(0, half), b = it.thingsToCarry.slice(half);
      for (let i = 0; i < half; i++) {
        w.ensure(7);
        for (const [s, x] of [[a[i], w.M], [b[i], w.M + cw + gap]] as const) {
          if (!s) continue;
          icon(w, 'dot', x + 1.8, w.y + 2.4, w.p.primary);
          w.textAt(s, x + 7, w.y, { role: 'body', size: 9.8, color: w.p.ink, maxW: cw - 8 });
        }
        w.y += 6.6;
      }
    } else bullets(w, it.thingsToCarry);
  }
  if ((photos.gallery || []).length >= 2) gallery(w, photos.gallery!);
  if (show('assumptions') && it.assumptions.length) {
    sectionTitle(w, SECTION_LABELS.assumptions, 'Fine print');
    bullets(w, it.assumptions, { color: w.p.muted, size: 9 });
  }
  if (show('contact')) backCover(w, it);

  stampChrome(w);
  const buffer = Buffer.from(w.doc.output('arraybuffer'));
  return { buffer, pageCount: w.doc.getNumberOfPages() };
}
