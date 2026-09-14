// Runtime asset URLs served from /public. Scenes and loaders reference assets
// through this registry instead of hardcoding paths, so moving a file or bumping
// a version happens in one place and `tests/engine-architecture.test.mjs` can
// verify that every registered file actually exists.
//
// Keep this module free of Three.js, React and DOM access: it is plain data.

export type RefugeBuildingModel = "workshop" | "oracle" | "city-gate";

export const ASSET_URLS = {
  /** Directory with three.js' Draco decoder (draco_wasm_wrapper.js, draco_decoder.wasm, draco_decoder.js). */
  dracoDecoder: "/game/draco/",
  /** Neon Sentinel player character (Mixamo rig, Draco geometry, WebP textures). */
  heroModel: "/game/models/mixamo/neon-sentinel-mixamo-test.glb",
  /** Refuge buildings placed by the base scene. */
  refugeBuilding: (name: RefugeBuildingModel) => `/base/models/${name}.glb`,
} as const;

const REFUGE_BUILDINGS: readonly RefugeBuildingModel[] = ["workshop", "oracle", "city-gate"];

/** Every concrete file behind the registry, for existence checks. */
export function registeredAssetFiles(): string[] {
  return [
    `${ASSET_URLS.dracoDecoder}draco_wasm_wrapper.js`,
    `${ASSET_URLS.dracoDecoder}draco_decoder.wasm`,
    `${ASSET_URLS.dracoDecoder}draco_decoder.js`,
    ASSET_URLS.heroModel,
    ...REFUGE_BUILDINGS.map(ASSET_URLS.refugeBuilding),
  ];
}
