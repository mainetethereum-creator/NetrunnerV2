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
  /** UI artwork imported from the CyberBase UI kits (`scripts/import-ui-kits.mjs`). Text is never baked in. */
  ui: {
    /** Hub background per layout; CSS loads only the one that matches the screen. */
    hubBackdrop: {
      desktop: "/ui/hub/backdrop-desktop.webp",
      landscape: "/ui/hub/backdrop-landscape.webp",
      portrait: "/ui/hub/backdrop-portrait.webp",
    },
    hubCharacter: "/ui/hub/character.webp",
    runnerAvatar: "/ui/hub/avatar-runner.webp",
    kitPlayerFrame: "/ui-kit/player-frame-yellow-v2.png",
    /** Hub feature cards: clean backgrounds, title artwork and "coming soon" badges (`scripts/import-hub-cards.mjs`). */
    hubCards: {
      season: "/ui/hub/feature-season.webp",
      skynet: "/ui/hub/feature-skynet.webp",
      nft: "/ui/hub/feature-nft.webp",
    },
    hubCardTitles: {
      season: "/ui/hub/title-season.webp",
      skynet: "/ui/hub/title-skynet.webp",
      nft: "/ui/hub/title-nft.webp",
    },
    /** Scene loading screen: the helmet with its eyes off and the red eye layer (`scripts/import-loading-helmet.mjs`). */
    loading: {
      helmet: "/ui/loading/helmet.webp",
      eyes: "/ui/loading/eyes-red.webp",
    },
    hubCardBadges: {
      season: "/ui/hub/badge-season.webp",
      skynet: "/ui/hub/badge-skynet.webp",
      nft: "/ui/hub/badge-nft.webp",
    },
  },
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
    ...Object.values(ASSET_URLS.ui.hubBackdrop),
    ASSET_URLS.ui.hubCharacter,
    ASSET_URLS.ui.runnerAvatar,
    ASSET_URLS.ui.kitPlayerFrame,
    ...Object.values(ASSET_URLS.ui.hubCards),
    ...Object.values(ASSET_URLS.ui.hubCardTitles),
    ...Object.values(ASSET_URLS.ui.hubCardBadges),
    ...Object.values(ASSET_URLS.ui.loading),
  ];
}
