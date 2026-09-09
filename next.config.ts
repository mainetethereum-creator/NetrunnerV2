import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: { root: process.cwd() },
  images: { minimumCacheTTL: 2_678_400 },
  async headers() {
    return [{ source: "/:path*.:ext(png|jpg|jpeg|webp|gif|svg|avif|ico|glb|woff|woff2|otf)", headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=604800" }] }];
  },
};

export default nextConfig;
