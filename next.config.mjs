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
    // Boots WhatsApp when the server starts (see instrumentation.ts).
    instrumentationHook: true,
    // Node-only libs used by the in-process WhatsApp service — load them from
    // node_modules at runtime instead of bundling them.
    serverComponentsExternalPackages: ['@whiskeysockets/baileys', 'pino', 'qrcode', 'jimp', 'link-preview-js', 'sharp'],
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
      // (A dev-only `Clear-Site-Data: "cache"` rule used to live here. It wiped
      // the browser cache on every page load, so every navigation in dev
      // re-downloaded all JS/CSS/fonts/images — removed.)
      ...(process.env.NODE_ENV === 'production'
        ? [{
            source: '/_next/static/:path*',
            headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
          }]
        : []),
    ];
  },
};

export default nextConfig;

