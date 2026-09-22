import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Empty turbopack config to suppress webpack warning
  turbopack: {},
  
  // Ensure WASM files are included in the server build (Next.js 16+ location)
  serverExternalPackages: [],
  outputFileTracingIncludes: {
    '/api/**/*': ['./lib/obfuscator-wasm/**/*.wasm'],
  },
};

export default nextConfig;
