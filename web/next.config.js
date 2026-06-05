/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow 5min API routes (Playwright takes time)
  serverExternalPackages: [],

  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
