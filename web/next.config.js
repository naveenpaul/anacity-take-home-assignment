/** @type {import('next').NextConfig} */
const API_INTERNAL = process.env.API_INTERNAL_URL || 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // Browser-side calls to /api/v1/* are proxied to NestJS, so the JWT
      // cookie set by NestJS lives on the web origin and is same-origin
      // for subsequent fetches. Server components hit NestJS directly.
      { source: '/api/v1/:path*', destination: `${API_INTERNAL}/v1/:path*` },
    ];
  },
};

module.exports = nextConfig;
