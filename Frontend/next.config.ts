import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*',
      },
      {
        source: '/upload/:path*',
        destination: 'http://127.0.0.1:8000/upload/:path*',
      },
      {
        source: '/chat/stream/:path*',
        destination: 'http://127.0.0.1:8000/chat/stream/:path*',
      }
    ];
  },
};

export default nextConfig;
