import { cache } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import TripDetailClient from './TripDetailClient';

// ISR: trip detail is public and identical for everyone. Render on the server
// and revalidate every 10 minutes so the HTML (including the JSON-LD) ships
// fully built instead of being fetched client-side after hydration.
export const revalidate = 600;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// cache() dedupes the fetch within a single request so generateMetadata and the
// page render share one DB round trip instead of two.
const getTrip = cache(async (idOrSlug: string) => {
  const supabase = createPublicClient();
  const query = supabase.from('trips').select('*');
  const { data } = UUID_RE.test(idOrSlug)
    ? await query.eq('id', idOrSlug).single()
    : await query.eq('slug', idOrSlug).single();
  return data as any;
});

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const trip = await getTrip(String(params.id));
  if (!trip) return {};
  const title = `${trip.title} — ${trip.destination}`;
  const description =
    trip.short_description || trip.description || `Join our ${trip.destination} group trip with Ghumakkars.`;
  const image = trip.cover_image_url || trip.image_url;
  return {
    title,
    description,
    alternates: { canonical: `/trips/${trip.slug || trip.id}` },
    openGraph: {
      title,
      description,
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export default async function TripDetailPage({ params }: { params: { id: string } }) {
  const trip = await getTrip(String(params.id));
  // Preserve the previous behaviour: a missing trip redirects to the list.
  if (!trip) redirect('/trips');
  return <TripDetailClient trip={trip} />;
}
