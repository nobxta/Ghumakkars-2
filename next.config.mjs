/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|webp|avif|ico)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, immutable' }],
      },
      // Production chunk names are content-hashed, so caching forever is safe.
      // In `next dev` the names never change, so this would pin stale JS in
      // the browser and cause hydration mismatches after every edit.
      ...(process.env.NODE_ENV === 'production'
        ? [{
            source: '/_next/static/:path*',
            headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
          }]
        : [{
            // Dev only: purge JS that browsers pinned under the old year-long
            // cache rule above, so they stop hydrating with stale code.
            source: '/((?!_next/|api/).*)',
            headers: [{ key: 'Clear-Site-Data', value: '"cache"' }],
          }]),
    ];
  },
};

export default nextConfig;

