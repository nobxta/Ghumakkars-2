import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient();
  const { data: trip } = await supabase
    .from('trips')
    .select('title, destination, description, short_description, discounted_price, start_date, end_date, duration_days, cover_image_url, image_url')
    .eq('id', params.id)
    .single();

  if (!trip) {
    return { title: 'Trip Not Found' };
  }

  const desc = trip.short_description || trip.description || '';
  const image = trip.cover_image_url || trip.image_url;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ghumakkars.in';
  const startDate = trip.start_date ? new Date(trip.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return {
    title: `${trip.title} - ${trip.destination} | ₹${trip.discounted_price?.toLocaleString()}`,
    description: `${desc.substring(0, 140)}. ${trip.duration_days} days trip to ${trip.destination}. Starting ₹${trip.discounted_price?.toLocaleString()}. ${startDate ? `Departing ${startDate}.` : ''} Book now!`,
    keywords: [
      `${trip.destination} trip`,
      `${trip.destination} budget trip`,
      `budget trip ${trip.destination}`,
      `${trip.title}`,
      'budget travel India',
      'Ghumakkars',
    ],
    alternates: { canonical: `/trips/${params.id}` },
    openGraph: {
      title: `${trip.title} - ${trip.destination} Trip`,
      description: `${trip.duration_days} days in ${trip.destination}. ₹${trip.discounted_price?.toLocaleString()}. Book with seat-lock!`,
      url: `${siteUrl}/trips/${params.id}`,
      images: image ? [{ url: image, width: 1200, height: 630, alt: trip.title }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${trip.title} | Ghumakkars`,
      description: `₹${trip.discounted_price?.toLocaleString()} • ${trip.duration_days} days • ${trip.destination}`,
      images: image ? [image] : [],
    },
  };
}

export default function TripLayout({ children }: { children: React.ReactNode }) {
  return children;
}
