/**
 * Inject Cloudinary delivery transforms (f_auto, q_auto, w_X) into a URL
 * so we serve modern formats (AVIF/WebP) at the right size.
 *
 * No-op for non-Cloudinary URLs.
 */
export function cldOptimize(url: string | undefined | null, width: number): string {
  if (!url) return '';
  if (!url.includes('res.cloudinary.com')) return url;
  // Already transformed (defensive — re-inserting is harmless but wasteful)
  if (url.includes('/upload/f_auto') || url.includes('/upload/q_auto')) return url;
  const transforms = `f_auto,q_auto,w_${width},c_limit`;
  return url.replace('/upload/', `/upload/${transforms}/`);
}

/** Common widths used across the app */
export const IMG = {
  cardThumb: (u?: string) => cldOptimize(u, 600),
  cardLarge: (u?: string) => cldOptimize(u, 900),
  hero: (u?: string) => cldOptimize(u, 1600),
  lightbox: (u?: string) => cldOptimize(u, 1920),
};
