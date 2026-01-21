/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    API_URL: process.env.API_URL || 'http://localhost:3001',
  },
  webpack: (config, { dev }) => {
    // Windows + non-ASCII paths can break webpack filesystem cache and cause missing chunks (blank screen).
    // Use in-memory cache during dev to avoid ENOENT/404 issues.
    if (dev) {
      config.cache = { type: 'memory' };
    }
    return config;
  },
};

module.exports = nextConfig;







