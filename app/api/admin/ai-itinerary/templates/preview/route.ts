import { NextResponse } from 'next/server';
import { adminRoute } from '@/lib/ai-itinerary/http';
import { getSettings } from '@/lib/ai-itinerary/settings';
import { cleanThemeOptions } from '@/lib/ai-itinerary/schema';
import { renderPdf } from '@/lib/ai-itinerary/service';
import type { Itinerary } from '@/lib/ai-itinerary/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Layout-only placeholder used to preview a theme. Clearly labelled; never saved or reused as content. */
const SAMPLE: Itinerary = {
  title: 'Sample Itinerary - Layout Preview',
  subtitle: 'Placeholder content to preview this theme',
  destination: 'Sample Destination',
  durationLabel: '3 Days / 2 Nights',
  startLocation: 'Starting City',
  travellers: 'Group',
  overview: 'This is placeholder text showing how the overview paragraph looks in this theme. Real itineraries are generated from your conversation in the Studio.',
  highlights: ['Highlight one', 'Highlight two', 'Highlight three'],
  days: [1, 2, 3].map((d) => ({
    day: d,
    title: `Day ${d} title`,
    route: d === 2 ? undefined : 'Place A - Place B',
    summary: 'Short day summary placeholder.',
    activities: [
      { time: 'Morning', title: 'Included activity', description: 'Activity description placeholder.', status: 'included' as const },
      { time: 'Afternoon', title: 'Optional activity', status: 'optional' as const },
      { time: 'Evening', title: 'Suggested activity', status: 'suggested' as const },
    ],
    meals: ['Breakfast', 'Dinner'],
    stay: d < 3 ? 'Hotel category placeholder' : undefined,
  })),
  stays: [{ location: 'Sample town', category: 'Hotel category placeholder', nights: '2', confirmed: false }],
  transport: [{ mode: 'Transport placeholder', confirmed: false }],
  inclusions: ['Inclusion placeholder', 'Inclusion placeholder'],
  exclusions: ['Exclusion placeholder'],
  pricing: [],
  pricingNote: 'Price on request (sample).',
  paymentTerms: [],
  cancellationPolicy: [],
  importantNotes: ['Important note placeholder.'],
  thingsToCarry: [],
  assumptions: ['This is a sample layout, not a real itinerary.'],
};

/** ?options=<ThemeOptions JSON incl. design prefs> — renders the placeholder itinerary in that design. */
export const GET = adminRoute(async ({ req }) => {
  const url = new URL(req.url);
  let opts: ReturnType<typeof cleanThemeOptions> = {};
  try { opts = cleanThemeOptions(JSON.parse(url.searchParams.get('options') || '{}')); } catch { /* ignore */ }
  const settings = await getSettings();
  const { buffer } = await renderPdf(settings, SAMPLE, { ...settings.pdf.defaultOptions, ...opts }, { seedKey: 'sample' });
  return new NextResponse(new Uint8Array(buffer), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="design-preview.pdf"', 'Cache-Control': 'private, no-store' },
  });
});
