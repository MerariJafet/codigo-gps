import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Rewrites disabled - using API routes instead
  // async rewrites() {
  //   return [
  //     {
  //       source: '/api/:path*',
  //       destination: 'http://backend:8000/:path*',
  //     },
  //   ]
  // },
};

export default nextConfig;
