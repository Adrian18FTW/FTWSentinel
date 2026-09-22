import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Turbopack configuration (Next.js 16+ default)
  experimental: {
    // Ensure WASM files are included in the server build
    serverComponentsExternalPackages: [],
    outputFileTracingIncludes: {
      '/api/**/*': ['./lib/obfuscator-wasm/**/*.wasm'],
    },
  },
  
  // Webpack configuration (fallback for --webpack flag)
  webpack: (config, { isServer }) => {
    // Enable WebAssembly support for server-side (API routes)
    if (isServer) {
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };
      
      // Ensure .wasm files are copied as assets
      config.module.rules.push({
        test: /\.wasm$/,
        type: 'asset/resource',
        generator: {
          filename: 'static/wasm/[name].[hash][ext]'
        }
      });
    }
    return config;
  },
};

export default nextConfig;
