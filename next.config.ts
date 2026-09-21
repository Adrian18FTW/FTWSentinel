import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Turbopack configuration (Next.js 16+ default)
  turbopack: {},
  
  // Webpack configuration (fallback for --webpack flag)
  webpack: (config, { isServer }) => {
    // Enable WebAssembly support for server-side (API routes)
    if (isServer) {
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };
    }
    return config;
  },
};

export default nextConfig;
