import type { NextConfig } from "next";

// Value of PHASE_DEVELOPMENT_SERVER from "next/constants", inlined so tests can import this config
// with plain Node (the next package has no ESM export map for that subpath).
const PHASE_DEVELOPMENT_SERVER = "phase-development-server";

// Development tools never reach players (ADR-019):
// - editor pages live in `app/**/page.dev.tsx` and are routes only when dev tools are on;
// - CYBERBASE_DEV_TOOLS is baked into the bundle as "1"/"0", so production builds compile out
//   the MASTER editor, debug panel and test teleports in BaseApp.tsx and Expedition.tsx.
// Dev tools are on in `next dev`; a deliberate test build can opt in with CYBERBASE_DEV_TOOLS=1.
const PAGE_EXTENSIONS = ["tsx", "ts", "jsx", "js"];
const DEV_PAGE_EXTENSIONS = ["dev.tsx", ...PAGE_EXTENSIONS];

export default function nextConfig(phase: string): NextConfig {
  const devTools = phase === PHASE_DEVELOPMENT_SERVER || process.env.CYBERBASE_DEV_TOOLS === "1";
  return {
    env: { CYBERBASE_DEV_TOOLS: devTools ? "1" : "0" },
    pageExtensions: devTools ? DEV_PAGE_EXTENSIONS : PAGE_EXTENSIONS,
    allowedDevOrigins: ["127.0.0.1", "localhost"],
    turbopack: { root: process.cwd() },
    images: { minimumCacheTTL: 2_678_400 },
    async headers() {
      return [{ source: "/:path*.:ext(png|jpg|jpeg|webp|gif|svg|avif|ico|glb|woff|woff2|otf)", headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=604800" }] }];
    },
  };
}
