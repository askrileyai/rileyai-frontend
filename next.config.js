/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,


  // Environment variables available to the browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  // Image optimization
  images: {
    domains: ['localhost', 'askrileyai.com'],
  },

  // Webpack configuration
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    return config;
  },

  // Redirects
  async redirects() {
    return [
      {
        source: '/extension',
        destination: process.env.NEXT_PUBLIC_EXTENSION_URL || '/',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
