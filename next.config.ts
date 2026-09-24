import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Configure Turbopack for WASM
  turbopack: {},
  
  // Configure webpack for WASM files
  webpack: (config, { isServer }) => {
    // Add WASM support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Handle .wasm files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

    return config;
  },
  
  // Ensure WASM files are included in the server build (Next.js 16+ location)
  serverExternalPackages: [],
  outputFileTracingIncludes: {
    '/api/**/*': ['./lib/obfuscator-wasm/**/*.wasm', './lib/obfuscator-wasm/**/*.js'],
  },
};

export default nextConfig;

// Cache bust: 2026-09-24 13:57:26
