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
  /** The one retained building from the district experiment. */
  implantsBuilding: "/base/models/implants-building.glb",
  elevatedRail: "/base/models/elevated-rail-v2.glb",
  sakuraPark: "/game/park/sakura-v1/sakura-kit.glb",
  sakuraSign: "/game/park/sakura-v1/neon-sign.webp",
  canalKit: "/game/canal/v1/canal-kit.glb",
  canalNormal: "/game/canal/v1/water-normal.webp",
  eastDistrict: "/game/east-district/v1/east-district.glb",
  railRuins: "/game/rail-ruins/v1/rail-ruins.glb",
  buildingAtlas: "/game/props/salvage/building-atlas.webp",
  /** Owner-selected v1 concepts, authored in Blender; loaded on catalogue demand. */
  referenceBuildings: {
    armory: "/game/buildings/reference-v1/armory.glb",
    restaurant: "/game/buildings/reference-v1/chinese-restaurant.glb",
    administration: "/game/buildings/reference-v1/central-administration.glb",
    mediaTower: "/game/buildings/media-tower-v1/media-tower.glb",
    glassCorner: "/game/buildings/glass-corner-v1/glass-corner.glb",
    japaneseCafe: "/game/buildings/japanese-cafe-v1/japanese-cafe.glb",
    walletTower: "/game/buildings/wallet-tower-v1/wallet-tower.glb",
    cyberbaseTower: "/game/buildings/cyberbase-tower-v1/cyberbase-tower.glb",
    japanesePartsShop: "/game/buildings/japanese-parts-shop-v1/japanese-parts-shop.glb",
    urbanOffice: "/game/buildings/urban-office-v1/urban-office.glb",
    cornerChamfer: "/game/buildings/corner-chamfer-v1/corner-chamfer.glb",
    cornerRounded: "/game/buildings/corner-rounded-v1/corner-rounded.glb",
    slenderGlass: "/game/buildings/slender-glass-v1/slender-glass.glb",
    slenderTerrace: "/game/buildings/slender-terrace-v1/slender-terrace.glb",
    outskirtsWreck: "/game/buildings/outskirts-wreck-v1/outskirts-wreck.glb",
    outskirtsBarrier: "/game/buildings/outskirts-barrier-v1/outskirts-barrier.glb",
    outskirtsGround: "/game/buildings/outskirts-ground-v1/outskirts-ground.glb",
  },
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
    ASSET_URLS.implantsBuilding,
    ASSET_URLS.elevatedRail,
    ASSET_URLS.sakuraPark,
    ASSET_URLS.sakuraSign,
    ASSET_URLS.canalKit,
    ASSET_URLS.canalNormal,
    ASSET_URLS.eastDistrict,
    ASSET_URLS.railRuins,
    ASSET_URLS.buildingAtlas,
    ...Object.values(ASSET_URLS.referenceBuildings),
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
