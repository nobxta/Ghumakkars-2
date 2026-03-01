/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ignore optional dependencies during build to prevent errors
      config.resolve.fallback = {
        ...config.resolve.fallback,
      };
      
      // Externalize packages that use native modules or break the server bundle
      const externalPackages = [
        'whatsapp-web.js',
        'qrcode-terminal',
        '@whiskeysockets/baileys',
        'sharp',
        'pino',
        'qrcode',
        '@hapi/boom',
      ];
      const originalExternals = config.externals || [];
      config.externals = [
        ...(Array.isArray(originalExternals) ? originalExternals : [originalExternals]),
        ({ request }, callback) => {
          if (request && externalPackages.some((pkg) => request === pkg || request.startsWith(pkg + '/'))) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    return config;
  },
};

export default nextConfig;

