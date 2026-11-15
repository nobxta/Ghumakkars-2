/**
 * Design generator for itinerary PDFs.
 *
 * Instead of fixed themes, every itinerary gets its own composition: a mood picks
 * plausible font pairings, palettes, cover compositions, day layouts, section-heading
 * styles and decorative motifs; a seed picks among them. Same prefs + seed = same
 * design (stable re-renders); "Shuffle" just changes the seed — no AI tokens.
 *
 * Client-safe (no Node APIs).
 */

export type Mood = 'brand' | 'editorial' | 'elegant' | 'bold' | 'earthy' | 'minimal' | 'playful';

export const MOODS: { key: Mood; label: string; hint: string }[] = [
  { key: 'brand', label: 'Ghumakkars', hint: 'Violet brand look, clean and premium' },
  { key: 'editorial', label: 'Editorial', hint: 'Magazine typography, photo-led' },
  { key: 'elegant', label: 'Elegant', hint: 'Refined serifs, gold and calm space' },
  { key: 'bold', label: 'Bold', hint: 'Big condensed type, energetic' },
  { key: 'earthy', label: 'Earthy', hint: 'Warm naturals for treks and retreats' },
  { key: 'minimal', label: 'Minimal', hint: 'Restrained, corporate-friendly' },
  { key: 'playful', label: 'Playful', hint: 'Friendly colours for students and groups' },
];

/* ─────────────────────────── fonts ─────────────────────────── */

export interface FontPair {
  key: string;
  name: string;
  head: string;        // display / headings
  headItalic: string;  // accents (subtitles, quotes)
  body: string;
  bodyMedium: string;
  bodyBold: string;
  bodyItalic: string;
  headUpper?: boolean; // e.g. Bebas Neue is all-caps by design
  headScale: number;   // optical size correction (condensed faces need more pt)
  moods: Mood[];
}

/** Font files live in assets/pdf-fonts/<name>.ttf (OFL, subset to Latin + ₹). */
export const FONT_PAIRS: FontPair[] = [
  { key: 'playfair-inter', name: 'Playfair Display × Inter', head: 'PlayfairDisplay-Bold', headItalic: 'PlayfairDisplay-Italic', body: 'Inter-Regular', bodyMedium: 'Inter-SemiBold', bodyBold: 'Inter-Bold', bodyItalic: 'Inter-Italic', headScale: 1, moods: ['brand', 'editorial', 'elegant'] },
  { key: 'cormorant-montserrat', name: 'Cormorant × Montserrat', head: 'CormorantGaramond-Bold', headItalic: 'CormorantGaramond-Italic', body: 'Montserrat-Regular', bodyMedium: 'Montserrat-SemiBold', bodyBold: 'Montserrat-Bold', bodyItalic: 'Montserrat-Italic', headScale: 1.12, moods: ['elegant', 'editorial'] },
  { key: 'bebas-poppins', name: 'Bebas Neue × Poppins', head: 'BebasNeue-Regular', headItalic: 'Poppins-Italic', body: 'Poppins-Regular', bodyMedium: 'Poppins-Medium', bodyBold: 'Poppins-SemiBold', bodyItalic: 'Poppins-Italic', headUpper: true, headScale: 1.3, moods: ['bold', 'playful'] },
  { key: 'fraunces-dmsans', name: 'Fraunces × DM Sans', head: 'Fraunces-SemiBold', headItalic: 'Fraunces-Italic', body: 'DMSans-Regular', bodyMedium: 'DMSans-SemiBold', bodyBold: 'DMSans-Bold', bodyItalic: 'DMSans-Italic', headScale: 1, moods: ['earthy', 'playful', 'brand'] },
  { key: 'dmserif-manrope', name: 'DM Serif × Manrope', head: 'DMSerifDisplay-Regular', headItalic: 'DMSerifDisplay-Italic', body: 'Manrope-Regular', bodyMedium: 'Manrope-SemiBold', bodyBold: 'Manrope-ExtraBold', bodyItalic: 'Inter-Italic', headScale: 1.04, moods: ['editorial', 'elegant', 'earthy'] },
  { key: 'outfit-inter', name: 'Outfit × Inter', head: 'Outfit-ExtraBold', headItalic: 'Inter-Italic', body: 'Inter-Regular', bodyMedium: 'Inter-SemiBold', bodyBold: 'Inter-Bold', bodyItalic: 'Inter-Italic', headScale: 1, moods: ['minimal', 'playful', 'brand', 'bold'] },
  { key: 'manrope', name: 'Manrope', head: 'Manrope-ExtraBold', headItalic: 'Inter-Italic', body: 'Manrope-Regular', bodyMedium: 'Manrope-SemiBold', bodyBold: 'Manrope-ExtraBold', bodyItalic: 'Inter-Italic', headScale: 1, moods: ['minimal'] },
  { key: 'montserrat-poppins', name: 'Montserrat × Poppins', head: 'Montserrat-Bold', headItalic: 'Montserrat-Italic', body: 'Poppins-Regular', bodyMedium: 'Poppins-Medium', bodyBold: 'Poppins-SemiBold', bodyItalic: 'Poppins-Italic', headScale: 1, moods: ['bold', 'brand', 'playful'] },
];

/** Fonts without the ₹ glyph — the renderer falls back to the body font for prices. */
export const FONTS_WITHOUT_RUPEE = new Set(['DMSerifDisplay-Regular', 'DMSerifDisplay-Italic', 'Outfit-Regular', 'Outfit-SemiBold', 'Outfit-ExtraBold']);

/* ─────────────────────────── palettes ─────────────────────────── */

export interface Palette {
  key: string;
  name: string;
  primary: string;   // main brand/accent colour
  accent: string;    // contrasting highlight
  ink: string;       // body text
  muted: string;     // secondary text
  paper: string;     // page background
  tint: string;      // soft panels
  dark: string;      // dark surfaces (covers, bands)
  moods: Mood[];
}

export const PALETTES: Palette[] = [
  { key: 'violet', name: 'Ghumakkars Violet', primary: '#7C3AED', accent: '#F59E0B', ink: '#1E1B2E', muted: '#6B6880', paper: '#FFFFFF', tint: '#F5F1FF', dark: '#1E1035', moods: ['brand', 'playful'] },
  { key: 'dusk', name: 'Himalayan Dusk', primary: '#1E3A5F', accent: '#E9A23B', ink: '#14202E', muted: '#5D6B7A', paper: '#FFFFFF', tint: '#EEF3F8', dark: '#0E1C2F', moods: ['editorial', 'bold', 'elegant'] },
  { key: 'teal', name: 'Ganga Teal', primary: '#0F766E', accent: '#F97316', ink: '#0F1F1D', muted: '#55706C', paper: '#FFFFFF', tint: '#ECF7F5', dark: '#0B2E2B', moods: ['earthy', 'playful', 'editorial'] },
  { key: 'desert', name: 'Desert Sand', primary: '#B4532A', accent: '#2F5D62', ink: '#2B1D14', muted: '#7A6656', paper: '#FFFBF5', tint: '#F8EEE2', dark: '#3A2418', moods: ['earthy', 'elegant'] },
  { key: 'forest', name: 'Forest Moss', primary: '#3F6212', accent: '#CA8A04', ink: '#1A2E05', muted: '#5B6B4C', paper: '#FCFCF7', tint: '#F1F5E8', dark: '#1D2B0D', moods: ['earthy', 'minimal'] },
  { key: 'gold', name: 'Midnight Gold', primary: '#A87B2F', accent: '#1C2541', ink: '#1C1917', muted: '#78716C', paper: '#FFFDF8', tint: '#F6F0E4', dark: '#14161F', moods: ['elegant', 'editorial'] },
  { key: 'coral', name: 'Coral Sunset', primary: '#E5484D', accent: '#F5A524', ink: '#2A1517', muted: '#7A5C5E', paper: '#FFFFFF', tint: '#FFF0EE', dark: '#3B1418', moods: ['playful', 'bold'] },
  { key: 'saffron', name: 'Saffron Trail', primary: '#EA580C', accent: '#0F172A', ink: '#1C1210', muted: '#6E5E57', paper: '#FFFFFF', tint: '#FFF4EC', dark: '#0F172A', moods: ['bold', 'earthy', 'playful'] },
  { key: 'ocean', name: 'Ocean Blue', primary: '#0369A1', accent: '#FBBF24', ink: '#0C1C2B', muted: '#52677A', paper: '#FFFFFF', tint: '#EAF5FC', dark: '#082F49', moods: ['playful', 'minimal', 'editorial'] },
  { key: 'rose', name: 'Rose Quartz', primary: '#BE185D', accent: '#7C3AED', ink: '#2A1020', muted: '#7B5C6C', paper: '#FFF9FB', tint: '#FCEEF4', dark: '#3B0A24', moods: ['elegant', 'playful'] },
  { key: 'ink', name: 'Ink & Paper', primary: '#111827', accent: '#7C3AED', ink: '#111827', muted: '#6B7280', paper: '#FFFFFF', tint: '#F3F4F6', dark: '#0B0F19', moods: ['minimal', 'editorial'] },
  { key: 'slate', name: 'Monsoon Slate', primary: '#334155', accent: '#65A30D', ink: '#0F172A', muted: '#64748B', paper: '#FFFFFF', tint: '#F1F5F9', dark: '#1E293B', moods: ['minimal', 'bold'] },
];

/* ─────────────────────────── layouts ─────────────────────────── */

export type CoverLayout = 'hero' | 'split' | 'arch' | 'collage' | 'band' | 'frame' | 'type' | 'diagonal';
export const COVERS: { key: CoverLayout; label: string; needsPhoto: boolean; moods: Mood[] }[] = [
  { key: 'hero', label: 'Full-bleed photo', needsPhoto: true, moods: ['editorial', 'bold', 'brand', 'playful'] },
  { key: 'split', label: 'Photo + type split', needsPhoto: true, moods: ['editorial', 'minimal', 'brand', 'earthy'] },
  { key: 'arch', label: 'Arched photo', needsPhoto: true, moods: ['elegant', 'earthy', 'brand'] },
  { key: 'collage', label: 'Photo collage', needsPhoto: true, moods: ['playful', 'editorial', 'bold'] },
  { key: 'band', label: 'Colour band', needsPhoto: false, moods: ['brand', 'earthy', 'playful', 'minimal'] },
  { key: 'frame', label: 'Framed classic', needsPhoto: false, moods: ['elegant'] },
  { key: 'type', label: 'Big typography', needsPhoto: false, moods: ['minimal', 'editorial', 'bold'] },
  { key: 'diagonal', label: 'Diagonal energy', needsPhoto: false, moods: ['bold', 'playful'] },
];

export type DayStyle = 'timeline' | 'cards' | 'magazine' | 'ledger';
export const DAY_STYLES: { key: DayStyle; label: string }[] = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'cards', label: 'Cards' },
  { key: 'magazine', label: 'Magazine' },
  { key: 'ledger', label: 'Ledger' },
];

export type SectionStyle = 'numbered' | 'bar' | 'rule' | 'centered' | 'overline';
export type Motif = 'mountains' | 'waves' | 'dots' | 'sun' | 'lines' | 'none';
export const MOTIFS: { key: Motif; label: string }[] = [
  { key: 'mountains', label: 'Mountains' }, { key: 'waves', label: 'Waves' }, { key: 'dots', label: 'Dots' },
  { key: 'sun', label: 'Sun rings' }, { key: 'lines', label: 'Lines' }, { key: 'none', label: 'None' },
];

/* ─────────────────────────── prefs → spec ─────────────────────────── */

/** What is stored per itinerary (theme_options.design). Unset = let the generator decide. */
export interface DesignPrefs {
  seed?: number;
  mood?: Mood;
  fonts?: string;
  palette?: string;
  cover?: CoverLayout;
  dayStyle?: DayStyle | 'mixed';
  motif?: Motif;
  /** Colours taken from a photo or a design-reference PDF. */
  extracted?: { primary: string; accent?: string; source: string } | null;
}

export interface DesignSpec {
  seed: number;
  mood: Mood;
  fonts: FontPair;
  palette: Palette;
  cover: CoverLayout;
  dayStyles: DayStyle[];      // one per day index (cycled), so pages vary
  section: SectionStyle;
  motif: Motif;
  radius: number;             // corner radius in mm
  coverTitleUpper: boolean;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, arr: T[]): T => arr[Math.floor(r() * arr.length) % arr.length];

export const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/** Derive a usable palette from extracted colours (photo / reference PDF). */
function paletteFromColour(primary: string, accent?: string): Palette {
  const [h, s, l] = hexToHsl(primary);
  const p = hslToHex(h, Math.min(0.75, Math.max(0.35, s)), Math.min(0.42, Math.max(0.28, l)));
  const a = accent ? accent : hslToHex((h + 0.5) % 1, 0.7, 0.5);
  return {
    key: 'extracted', name: 'From your photo / reference', primary: p, accent: a,
    ink: hslToHex(h, 0.3, 0.1), muted: hslToHex(h, 0.1, 0.42), paper: '#FFFFFF',
    tint: hslToHex(h, 0.45, 0.96), dark: hslToHex(h, 0.45, 0.12), moods: [],
  };
}

export function resolveDesign(prefs: DesignPrefs | undefined, ctx: { photoCount: number; dayCount: number; legacyTheme?: string }): DesignSpec {
  const p = prefs || {};
  const seed = p.seed ?? hashString(ctx.legacyTheme || 'ghumakkars');
  const r = rng(seed);
  const mood: Mood = p.mood || pick(r, ['brand', 'brand', 'editorial', 'earthy', 'playful', 'elegant', 'bold', 'minimal'] as Mood[]);

  const fontsPool = FONT_PAIRS.filter((f) => f.moods.includes(mood));
  const fonts = FONT_PAIRS.find((f) => f.key === p.fonts) || pick(r, fontsPool.length ? fontsPool : FONT_PAIRS);

  let palette: Palette;
  if (p.palette === 'extracted' && p.extracted) palette = paletteFromColour(p.extracted.primary, p.extracted.accent);
  else palette = PALETTES.find((x) => x.key === p.palette) || (mood === 'brand' ? PALETTES[0] : pick(r, PALETTES.filter((x) => x.moods.includes(mood))));

  const hasPhoto = ctx.photoCount > 0;
  const coverPool = COVERS.filter((c) => c.moods.includes(mood) && (!c.needsPhoto || hasPhoto) && (c.key !== 'collage' || ctx.photoCount >= 3));
  const chosenCover = COVERS.find((c) => c.key === p.cover);
  const cover: CoverLayout = chosenCover && (!chosenCover.needsPhoto || hasPhoto)
    ? chosenCover.key
    : pick(r, coverPool.length ? coverPool : COVERS.filter((c) => !c.needsPhoto)).key;

  // Day pages vary: a base style plus an alternate, interleaved with some randomness.
  const all: DayStyle[] = ['timeline', 'cards', 'magazine', 'ledger'];
  let dayStyles: DayStyle[];
  if (p.dayStyle && p.dayStyle !== 'mixed') dayStyles = [p.dayStyle];
  else {
    const base = pick(r, all);
    const alt = pick(r, all.filter((x) => x !== base));
    dayStyles = Array.from({ length: Math.max(1, ctx.dayCount) }, (_, i) => (r() < 0.62 ? (i % 2 === 0 ? base : alt) : pick(r, all)));
  }

  const sectionByMood: Record<Mood, SectionStyle[]> = {
    brand: ['bar', 'numbered', 'overline'], editorial: ['numbered', 'rule', 'overline'], elegant: ['centered', 'rule'],
    bold: ['numbered', 'bar'], earthy: ['overline', 'bar', 'rule'], minimal: ['rule', 'overline'], playful: ['bar', 'overline', 'numbered'],
  };
  const motifByMood: Record<Mood, Motif[]> = {
    brand: ['mountains', 'dots', 'sun'], editorial: ['lines', 'none', 'dots'], elegant: ['sun', 'none', 'lines'],
    bold: ['mountains', 'lines', 'dots'], earthy: ['mountains', 'waves', 'sun'], minimal: ['none', 'lines', 'dots'], playful: ['waves', 'dots', 'sun'],
  };
  const section = pick(r, sectionByMood[mood]);
  const motif = p.motif || pick(r, motifByMood[mood]);
  const radius = mood === 'minimal' || mood === 'elegant' ? pick(r, [0, 1.2]) : pick(r, [2.5, 3.5, 5]);
  return { seed, mood, fonts, palette, cover, dayStyles, section, motif, radius, coverTitleUpper: !!fonts.headUpper || (mood === 'bold' && r() < 0.5) };
}

export function describeDesign(d: DesignSpec): string {
  return `${MOODS.find((m) => m.key === d.mood)?.label} · ${d.fonts.name} · ${d.palette.name} · ${COVERS.find((c) => c.key === d.cover)?.label} cover`;
}

/* ─────────────────────────── colour utils ─────────────────────────── */

export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function hexToHsl(hex: string): [number, number, number] {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16) / 255, g = parseInt(n.slice(2, 4), 16) / 255, b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

export function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}
