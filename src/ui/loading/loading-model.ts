// Loading-screen maths (ADR-021): the percent the screen moves toward, the visual stage for a percent,
// and a readable name for the file being loaded. No React or Three.js, so tests can run it directly.

export type LoadingStage = "void" | "awaken" | "watch" | "lock";

export interface LoadingCounts {
  /** Files finished by the loading manager. */
  loaded: number;
  /** Files requested so far (grows while scenes queue more). */
  total: number;
  /** The scene reported it can be shown. */
  ready: boolean;
  /** Time since the screen appeared. */
  elapsedMs: number;
}

/**
 * Target percent: a short warm-up while game code downloads (0–12%), then real files (12–92%).
 * Never moves backwards when more files are queued, and stays at or below 95% until ready.
 */
export function loadingTarget(counts: LoadingCounts, previous: number): number {
  if (counts.ready) return 100;
  const warmup = Math.min(12, (Math.max(0, counts.elapsedMs) / 2500) * 12);
  const files = counts.total > 0 ? 12 + (Math.min(counts.loaded, counts.total) / counts.total) * 80 : 0;
  return Math.min(95, Math.max(previous, warmup, files));
}

/** Time the helmet needs to wake up (darkness 0–12%, light sweep and eye ignition 12–25%). */
export const WAKE_UP_MS = 1300;

/**
 * Keeps the wake-up visible on fast, cached loads: during the first WAKE_UP_MS the shown percent
 * cannot pass the pace of darkness (0–12% in 0.4 s) and awakening (12–25% in 0.9 s).
 */
export function pacedPercent(percent: number, elapsedMs: number): number {
  if (elapsedMs >= WAKE_UP_MS) return percent;
  const elapsed = Math.max(0, elapsedMs);
  const cap = elapsed < 400 ? (12 * elapsed) / 400 : 12 + (13 * (elapsed - 400)) / 900;
  return Math.min(percent, cap);
}

/** Visual stage: darkness, the helmet waking up, the eyes watching, the eyes locking on. */
export function loadingStage(percent: number): LoadingStage {
  if (percent < 12) return "void";
  if (percent < 25) return "awaken";
  if (percent < 90) return "watch";
  return "lock";
}

/** Name of the file group being loaded, from its URL. */
export function assetLabel(url: string): string {
  const path = url.toLowerCase().split("?")[0];
  if (path.startsWith("blob:") || path.startsWith("data:")) return "Textures";
  if (path.includes("/draco/")) return "Draco decoder";
  if (path.includes("/game/models/")) return "Neon Sentinel · rig & animations";
  if (path.includes("/base/models/")) return "Refuge buildings";
  if (path.includes("/materials/")) return "Materials · concrete, metal, stone";
  if (path.includes("/props/")) return "Salvage props & buildings";
  if (path.includes("/vehicles/")) return "Vehicles";
  if (path.includes("/vegetation/")) return "Vegetation";
  if (/\.(glb|gltf)$/.test(path)) return "Models";
  if (/\.(webp|png|jpe?g|ktx2|hdr)$/.test(path)) return "Textures";
  return "Game data";
}
