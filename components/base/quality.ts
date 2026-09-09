export type QualityMode = "auto" | "high" | "lite";
export type QualityState = { mode: QualityMode; high: boolean; scale: number; slowWindows: number };

export function initialQuality(mobile: boolean, mode: QualityMode = "auto"): QualityState {
  return { mode, high: mode === "high" || (mode === "auto" && !mobile), scale: mobile ? 1 : 1.35, slowWindows: 0 };
}

// Only sustained slow windows count; never react to a single frame / asset decode.
// No automatic promotion, so borderline hardware cannot oscillate between modes.
export function adaptQuality(state: QualityState, fps: number): QualityState {
  if (state.mode !== "auto" || !Number.isFinite(fps) || fps <= 0) return state;
  const slowWindows = fps < 48 ? state.slowWindows + 1 : 0;
  if (slowWindows < 3) return { ...state, slowWindows };
  if (state.high) return { ...state, high: false, slowWindows: 0 };
  return { ...state, scale: Math.max(0.7, Math.round((state.scale - 0.15) * 100) / 100), slowWindows: 0 };
}

export function renderRatio(width: number, height: number, deviceRatio: number, state: QualityState) {
  const maxPixels = state.high ? 1_500_000 : 700_000;
  return Math.max(0.5, Math.min(deviceRatio, state.scale, Math.sqrt(maxPixels / Math.max(1, width * height))));
}
