import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ghumakkars.in';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/auth/', '/profile/', '/bookings/', '/wallet/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
