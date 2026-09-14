import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Architecture boundaries for the new layered code in src/ (see ARCHITECTURE.md).
// Legacy components/ are migrated into these layers step by step.
const legacyComponents = { group: ["**/components/**", "@/components/**"], message: "src/ layers must not depend on legacy components/; move the code into src/ first." };
const threeJs = { group: ["three", "three/*"], message: "Only src/renderer (and legacy scenes) may import Three.js." };
const uiFrameworks = { group: ["react", "react-dom", "react/*", "next", "next/*"], message: "React/Next belong in src/ui and app/, not in engine layers." };

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".cache/**", ".dream-loop/**", ".next/**", "vendor/**", "public/**", "next-env.d.ts"]),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: [legacyComponents] }] },
  },
  {
    files: ["src/{core,gameplay,world,input,shared}/**/*.{ts,tsx}", "src/assets/registry.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [legacyComponents, threeJs, uiFrameworks] }] },
  },
]);
