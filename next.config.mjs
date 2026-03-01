/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ignore optional dependencies during build to prevent errors
      config.resolve.fallback = {
        ...config.resolve.fallback,
      };
      
      // Add to externals to prevent webpack from trying to bundle them
      const originalExternals = config.externals || [];
      config.externals = [
        ...(Array.isArray(originalExternals) ? originalExternals : [originalExternals]),
        ({ request }, callback) => {
          if (request === 'whatsapp-web.js' || request === 'qrcode-terminal') {
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

