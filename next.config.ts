import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // The global stylesheet is small but otherwise costs an extra render-blocking
    // round trip before the text-only LCP can paint.
    inlineCss: true,
  },
  turbopack: { root: process.cwd() },
};

export default nextConfig;
