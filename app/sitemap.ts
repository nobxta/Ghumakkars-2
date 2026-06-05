import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ghumakkars.in';

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${siteUrl}/trips`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/auth/signin`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${siteUrl}/auth/signup`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ];

  try {
    const supabase = createAdminClient();
    const { data: trips } = await supabase
      .from('trips')
      .select('id, updated_at, status, is_active')
      .or('is_active.eq.true,status.in.(completed,cancelled,postponed)');

    const tripPages: MetadataRoute.Sitemap = (trips || []).map((trip) => ({
      url: `${siteUrl}/trips/${trip.id}`,
      lastModified: trip.updated_at ? new Date(trip.updated_at) : new Date(),
      changeFrequency: trip.is_active ? 'daily' : 'monthly',
      priority: trip.is_active ? 0.8 : 0.4,
    }));

    return [...staticPages, ...tripPages];
  } catch {
    return staticPages;
  }
}
