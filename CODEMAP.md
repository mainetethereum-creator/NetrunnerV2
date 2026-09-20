# Code map

Layer tags: **[R]** React UI · **[3]** Three.js · **[P]** pure logic (no three/react) ·
**[S]** browser storage/DOM · **[E]** engine loop. Target layers: see `ARCHITECTURE.md` §4.

## Root

Canal / future forest boundary: `src/renderer/environment/canal-layout.ts` [P]
owns placements/closed-crossing solids; `canal.ts` [3] loads/instances the Blender
kit and `canal-water.ts` [3] safely shares the courtyard reflection. Base
`zones.ts` clips the old backdrop without changing saved pivots. Builder:
`scripts/build-canal-kit.py` → `.blend`/GLB; `scripts/pack-canal-textures.mjs`
embeds WebP. Notes: `docs/canal.md`; checks: `tests/canal.test.mjs`.

Sakura park (active local Base frontage): `src/renderer/environment/sakura-park.ts`
[3] owns instanced Blender assets/VFX; `sakura-park-layout.ts` [P] shares paths,
delivery poses and collision; `park-ground.ts` [3] blends paving/planting and
reflection coverage. `src/audio/garden-ambience.ts` [S] owns opt-in audio.
`garden-facade-sign.ts` [3] adds Base-only signs through the reference library.
Builder: `scripts/build-sakura-park.py` → `.blend`/GLB, then
`scripts/pack-sakura-textures.mjs`. Notes: `docs/sakura-park.md`;
checks: `tests/sakura-park.test.mjs`. The road modules below are retained but
no longer instantiated by the working Base scene.

Movable metro opening: `src/renderer/environment/metro-opening.ts` [3] owns live
clipping planes/material copies and binds the pristine editor delta. Base scene
applies them to foundation/stone; `wet-floor.ts` clips the Reflector shader;
`base-map-editor.ts` updates the cut on original metro transforms/delete/undo.
Stairs/shell/guide lighting: `components/base/metro.ts`. Notes:
`docs/metro-opening.md`; coverage: `tests/metro-opening.test.mjs`.

City frontage/traffic: `src/renderer/environment/city-street.ts` [3] owns the
street batches/resources; `city-vehicles.ts` + `city-street-geometry.ts` [3] build
reusable 3D shells/material batches; `city-traffic-layout.ts` [P] defines lanes,
headways and constant-speed poses. Base scene supplies the shared clock;
`BaseApp.tsx` persists the City traffic switch. `scripts/place-city-street.mjs`
removes only the previous task's scenery IDs. Notes: `docs/city-street.md`;
checks: `tests/city-street.test.mjs`.

Corner / slender tower / outskirts kit: `scripts/build-outskirts-kit.py` → seven
`public/game/buildings/<slug>-v1/` GLBs. `scripts/place-outskirts-kit.mjs` reproduces
the map additions. Notes: `docs/outskirts-kit.md`; tests: `tests/outskirts-kit.test.mjs`.
Ground collision policy: `src/assets/reference-buildings.ts`; burning drum:
`components/expedition/prop-assets.ts` (reuses existing drum/campfire).

Approved CYBERBASE / parts / office trio: `scripts/build-city-trio.py` →
`public/game/buildings/{cyberbase-tower,japanese-parts-shop,urban-office}-v1/`.
Shared catalogue IDs use the same slugs prefixed `building-`.
Geometry/artwork/resource contracts: `tests/city-trio.test.mjs`; notes: `docs/city-trio.md`.

Approved Coinbase wallet tower: `scripts/build-wallet-tower.py` →
`public/game/buildings/wallet-tower-v1/wallet-tower.glb`; shared catalogue ID
`building-wallet-tower`. Actual asset contracts: `tests/wallet-tower.test.mjs`.
Static separate ticker and integration: `docs/wallet-tower.md`.

Approved Japanese café: `scripts/build-japanese-cafe.py` →
`public/game/buildings/japanese-cafe-v1/japanese-cafe.glb`; shared catalogue ID
`building-japanese-cafe`. Asset contracts: `tests/japanese-cafe.test.mjs`.
Model notes and saved armory replacement: `docs/japanese-cafe.md`.

Approved second glass corner: `scripts/build-glass-corner.py` →
`public/game/buildings/glass-corner-v1/glass-corner.glb`; the existing registry and
reference-building library expose `building-glass-corner` in both editors.
`tests/glass-corner.test.mjs` checks artwork, actual mesh/bounds and resource sharing.
Feature notes and saved Base placement: `docs/glass-corner.md`.

Approved media tower: `scripts/build-media-tower.py` → `public/game/buildings/media-tower-v1/media-tower.glb`;
`src/assets/media-tower.ts` [P] holds Base placement/bounds; `src/renderer/environment/media-tower.ts` [3]
owns its async instance/library. Shared `reference-buildings.ts`/`reference-building-library.ts`
register/load it for both catalogues. `tests/media-tower.test.mjs` verifies source portrait bytes,
real mesh budgets, navigation and lifecycle. Feature notes: `docs/media-tower.md`.

| Path | Purpose |
|---|---|
| `app/` | Next.js routes (see ARCHITECTURE §1.1) |
| `components/` | Game code (legacy layout, being migrated into `src/`) |
| `src/` | New layered engine code (`assets/`, `core/loop/`, `input/`, `renderer/camera/`, `renderer/three/`, `ui/hub/`, `ui/loading/`) |
| `ROADMAP.md` | Work queue: remaining architecture steps with instructions, technical debt register, verification protocol, log |
| `next.config.ts` | Next config by phase: development pages (`page.dev.tsx`) and `CYBERBASE_DEV_TOOLS` only in `next dev` (ADR-019); image cache headers |
| `lib/wagmi.ts` | Wallet (wagmi) config: Base mainnet only, `baseAccount` connector + EIP-6963 injected wallets, cookie storage, Builder Code attribution (target rules: ADR-016) |
| `public/` | Runtime assets (models, textures, atlases, draco decoder, vegetation bin, UI images) |
| `assets/fonts/Martius` | Display font (licensed, see LICENSE.txt) |
| `vendor/vegetation` | MIT tree generator used only by the vegetation editor |
| `scripts/` | Bakes (landscape, vegetation), asset audit, agent process cleanup, `import-ui-kits.mjs` (UI kit artwork → WebP), `import-hub-cards.mjs` (owner HUBB card art, titles, badges → WebP), `import-loading-helmet.mjs` (loading helmet → helmet + red eye layers) |
| `tests/` | `node:test` suites (`npm test`) |
| `docs/` | Feature notes (expeditions, combat HUD, buildings, mobile performance, fences, vegetation, budgets); `ui-kits/` (kit mapping, references, layout grids) |
| `eslint.config.mjs` | Next lint config + **src/ boundary rules** |
| `.dream-loop/`, `.cache/` | Git-ignored agent/browser scratch, not part of the game |

## src/ (new layers)

| File | Purpose |
|---|---|
| `src/assets/registry.ts` | **[P]** Runtime asset URLs (Draco decoder, hero model, refuge buildings, UI kit artwork `ui.*`) + `registeredAssetFiles()` |
| `src/ui/hub/HubApp.tsx` | **[R]** Hub landing page `/`: backdrop + character layers, logo, profile, wallet menu (wagmi), navigation (side list / portrait tab bar), PLAY, cards; three layouts |
| `src/ui/hub/hub-content.ts` | **[P]** Hub navigation items, card texts/tones/routes/artwork, `shortAddress` |
| `src/ui/hub/HubIcon.tsx`, `Hub.module.css` | **[R]** Hub SVG icons; hub styles (chamfered CSS frames, portrait → landscape → desktop breakpoints) |
| `src/core/loop/frame-loop.ts` | **[E]** `createFrameLoop` — rAF scheduling, hidden-tab `stop`/`skip`, mobile cadence cap, clamped delta, `fixedUpdate → update → render` with `alpha`; injectable platform |
| `src/input/movement-input.ts` | **[P]** `createMovementInput` — held keys + stick → camera-relative direction (`resolve`), run key, stick clamping |
| `src/input/keyboard/move-keys.ts` | **[P]** WASD/arrow bindings, expedition editor pan bindings (Q as back), `keyAxis` |
| `src/input/touch/stick-vector.ts` | **[P]** `stickVector` dead zone + radial clamp (re-exported by `expedition/mobile-performance.ts`) |
| `src/renderer/camera/follow-camera.ts` | **[P]** `createFollowCamera(preset, pivot)` — isometric follow: pivot damping + optional snap, portrait distance, `place` camera position, MASTER `zoomBy` / `pan` / `nudge` / `moveTo`, `snapToTarget`; presets `BASE_CAMERA`, `EXPEDITION_CAMERA`, `METRO_CAMERA` (no three import) |
| `src/input/keyboard/physical-movement-key.ts` | **[P]** Physical WASD/arrows/Shift normalization used by Base keydown/keyup, including non-Latin layouts; scene retains focus/modal gating. `tests/physical-movement-key.test.mjs` covers normalization, release, direction, run and diagonal speed. Tactical is the only Base camera (ADR-026); experimental camera modules were removed. |
| `src/renderer/three/loading-progress.ts` | **[3]** `watchLoadingProgress` — real file counts from three.js' `DefaultLoadingManager` for the loading screen (keeps existing handlers) |
| `src/ui/loading/LoadingScreen.tsx`, `LoadingScreen.module.css` | **[R]** Scene loading screen (base, expedition): pixel helmet, red eyes, real percent / files, error + reload, dissolves when ready (ADR-021) |
| `src/ui/loading/loading-model.ts` | **[P]** Loading maths: `loadingTarget`, `pacedPercent` (wake-up pace), `loadingStage`, `assetLabel` |
| `src/ui/kit/kit.module.css`, `Glyph.tsx` | **[R]** CyberBase 2D UI kit in the game world (branch `feature/ui-kit-3d`): tokens scoped to `.kit`, chamfer / button / chip / pips / bar primitives, button reset over legacy `.root button`; shared line icons (re-exported by `GameHud.tsx`) |
| `src/ui/dialogue/NpcDialogue.tsx`, `NpcDialogue.module.css` | **[R]** NPC dialogue docked to the bottom of the 3D view: speaker in zone colour, numbered choices (keys 1–9), exit 0, locked choices with reason, quest checklist; desktop / portrait / landscape |
| `src/ui/character/RunnerPanel.tsx`, `Loadout.tsx`, `AbilityMatrix.tsx`, `character.module.css` | **[R]** Character panel shell, loadout (wearing / carrying / adds up to, locker + unsecured backpack, filter, sort, equip), ability matrix (class switch, 4 skills × 3 modules × 5 ranks, effect lines, locked reasons); props only, no game imports |
| `src/ui/character/talent-upgrades.ts` | **[P]** Proposed talent module names and percentages per class / skill slot, `talentEffect` outcome lines, `CLASS_ROLES` |
| `src/renderer/three/gltf-loader.ts` | **[3]** `createGltfLoader()` — GLTFLoader with shared Draco decoder |
| `src/renderer/three/dispose.ts` | **[3]** `disposeObjectTree()` — dispose geometries, materials, textures once |
| `src/renderer/environment/implants-building.ts` | **[3]** The sole retained IMPLANTS facade, two signs and one unshadowed light; scene-owned async loading/disposal, no gameplay/update loop |
| `scripts/build-night-market.py`, `scripts/extract-implants.mjs` | Original Blender kit builder and lossless Implants-only GLB extraction; original kit retained for recovery, not loaded by the game |
| `tests/base-city-assets.test.mjs` | Retained Implants hierarchy, standalone geometry/material/byte budgets, no character rigs |

## app/

| File | Purpose |
|---|---|
| `layout.tsx` | Root layout, Martius font, `Web3Provider` |
| `page.tsx` | `/` → `HubApp` (hub landing page) |
| `base/page.tsx` | `/base` → `BaseApp` |
| `expedition/page.tsx` | `/expedition` → `Expedition` |
| `metro/page.tsx` | `/metro` → `Metro3D` |
| `editor/vegetation/page.dev.tsx` | `/editor/vegetation` → `VegetationEditor` (development only, ADR-019) |
| `ui-kit-preview/*` | UI kit sandbox (Ghost Signal, ability matrix, `matrix-state.ts` [P]); `page.dev.tsx`, development only |
| `globals.css` | Global styles + CyberBase UI kit tokens (`--cb-*`: colors, font, chamfer clip, corner lines) |

## components/base — Runner's Refuge (`/base`)

| File | Purpose |
|---|---|
| `BaseApp.tsx` | **[R][S]** Base UI: loading, NPC dialogues (`DIALOGUE`; portrait / name bar / text / replies per the Dialogue kit), orientation quest (localStorage), wallet dialog, settings (incl. return to hub), minimap/destinations, interact button, MASTER toggle, HUD |
| `BaseApp.module.css` | Base UI styles incl. touch layout; UI kit skin and NPC dialog layouts (desktop / portrait / landscape) at the end |
| `BaseEditorPanel.tsx` | **[R]** MASTER panel for the base (lazy) |
| `base-map-editor.ts` | **[3]** Lazy Base editor integration: pristine scenery catalogue, authored callbacks and gameplay/editor render switching |
| `editable-render.ts` | **[3]** Reconstruct labelled logical objects from retained batched sources; preserve instance colors/shaders; rebatch when MASTER closes |
| `editor-colliders.ts` | **[3]** Stable ownership of authored Base collider indices; transformed/deleted overrides without mutating original constants |
| `scene.ts` | **[3][E]** `createBaseScene`: renderer/composer/lights, refuge geometry, NPCs, GLB buildings, hero + animation + combat, input, camera, rain, quality, loop, MASTER, snapshots |
| `world.ts` | **[P]** Spawn, bounds, colliders, stations, `canStand`, `moveWithCollision`, `findPath`, `nearestStation`, editor overrides (module state) |
| `quality.ts` | **[P]** Desktop quality modes and render ratio |
| `materials.ts` | **[3]** PBR refuge surfaces (concrete/metal/stone), sky texture; shared by expedition/metro |
| `wetness.ts` | **[P]** Wetness GLSL chunk |
| `wet-floor.ts` | **[3]** Reflective puddle receiver over the full open city construction pad (High quality) |
| `zones.ts` | **[3]** Service street, kiosks, signs, market, lights |
| `metro.ts` | **[3]** Movable metro entrance plus the solid, expanded courtyard floor geometry |
| `buildings.ts` | **[3]** `ArchitectureTools` type + city architecture builder |
| `district.ts` | **[3]** District builder (currently unreferenced) |
| `fence.ts` | **[3]** Retained front concrete fence line; other perimeter runs removed for city expansion |
| `details.ts` | **[3][S]** Animated surface details |
| `npc.ts` | **[3]** Stylised refuge NPC meshes |

## components/expedition — Outlands (`/expedition`)

| File | Purpose |
|---|---|
| `Expedition.tsx` | **[R][S]** Expedition UI: HUD, map, objective, loot, stick, interaction, MASTER panel (props/trees/landscape), debug, result + stash save |
| `scene.ts` | **[3][E]** `createExpedition`: renderer/composer, environment, lights pool, hero, enemies pool, input, camera, session tick, streaming, loop, editors |
| `session.ts` | **[P]** `ExpeditionSession`: hp, bag, discovery, loot, encounters, events, extraction, combat hits |
| `config.ts` | **[P]** Sectors, items, loot tables, POIs, extractions, encounters, events, spawn, bounds |
| `world.ts` | **[P][S]** `makeWorld` (collision grid, elevation, overrides), `move`, `findRoute`, vegetation trees |
| `terrain.ts`, `landscape-state.ts`, `landscape-authored.ts` | **[P]** Terrain height, landscape patches |
| `landscape.ts`, `landscape-studio.ts`, `LandscapePanel.tsx` | **[3][R][S]** Ground rendering, grass, landscape authoring |
| `environment.ts` | **[3]** Chunks, instanced batches, POI/extraction markers, labels, light sources |
| `authored-layout.ts`, `authored-district.ts` | **[P]/[3]** Authored placements + colliders; district build |
| `cyber-buildings.ts`, `cyber-concrete.ts`, `building-props.ts`, `city-props.ts`, `security-fences.ts`, `prop-assets.ts`, `PropPreview.tsx` | **[3]** Procedural building/prop catalogue, atlases, preview |
| `microbus.ts`, `microbus-layout.ts` | **[3]/[P]** Wrecked microbus |
| `nature.ts`, `nature-layout.ts`, `dressing.ts`, `dressing-layout.ts`, `street-detail.ts`, `distance-detail.ts` | **[3]/[P]** Fountain, walls, wrecks, fires, street litter, detail fade |
| `fence-layout.ts` | **[P]** Fence ids, lengths, snapping, colliders |
| `grass-system/` | **[3]** MIT grass (+ noise GLSL) |
| `prop-editor.ts`, `tree-editor.ts` | **[3]** MASTER editor adapters (lazy) |
| `mobile-performance.ts` | **[P]** Touch profile, mobile render budget (also used by base); re-exports `stickVector` from `src/input/touch` |
| `frame-throttle.ts` | **[E]** Rate limiter / throttled scheduler |

## components/game — shared gameplay UI and character

| File | Purpose |
|---|---|
| `GameHud.tsx` | **[R][S]** Vitals (runner avatar), skills 1–4, menu, panels; listens to `netrunner:stats|panel`, dispatches `netrunner:cast`; UI kit skin at the end of `GameHud.module.css` |
| `CharacterPanel.tsx`, `character-draft.ts` | **[R][S]/[P]** Adapter from game data (class, draft, stash, backpack) to the UI kit panels in `src/ui/character`; draft rules: attributes, talents, `talentBlockReason` |
| `MovementStick.tsx` | **[R]** Touch stick → `onMove`, resets on blur/visibility/modals |
| `combat.ts` | **[P]** Classes, skills, `CombatState` |
| `combat-driver.ts` | **[3][S]** Energy/cooldowns bridge, attack clip playback, sword/gun visuals, window events |
| `class-actions.ts`, `run-retarget.ts` | **[3]** Retargeted donor attack clips (`shoot.glb`) |
| `sword-attack.ts` | **[3]** Procedural great sword, grips, pose clips |
| `pose-controller.ts` | **[3]** Procedural arms-down idle for rigs without an Idle clip |

## components/metro3d — Lower Lines (`/metro`, frozen)

| File | Purpose |
|---|---|
| `Metro3D.tsx` | **[R]** Metro UI |
| `scene.ts` | **[3][E]** `createMetro` |
| `environment.ts` | **[3]** Metro rooms and lights |
| `world.ts` | **[P]** Grid rooms, routes, movement |

## components/world-editor — MASTER (in-game editor, lazy)

| File | Purpose |
|---|---|
| `lazy-editor.ts` | **[P]** Dynamic facade; activation or inactive `initialize()` awaits saved-map `ready` |
| `controller.ts` | **[3][S]** Selection, transforms, duplicate, delete, place, undo/redo, async save restoration/import with independent ghost cancellation and pending/failed save guards |
| `document.ts` | **[P]** Versioned editor document, validation, history |
| `streaming.ts` | **[3]** Placement culling |
| `WorldEditorPanel.tsx` | **[R]** Editor panel |

## components/vegetation, components/editor

| File | Purpose |
|---|---|
| `vegetation/format.ts`, `layout.ts` | **[P]** Vegetation asset format and tree layout |
| `vegetation/render.ts`, `baked-runtime.ts` | **[3]** Runtime tree/grass rendering from the baked bin |
| `vegetation/tree-editor-state.ts` | **[S]** Saved tree placements |
| `editor/VegetationEditor.tsx`, `bake.ts`, `preview.ts` | **[R][3]** Offline vegetation generator (dev tool) |

## components/providers

| File | Purpose |
|---|---|
| `Web3Provider.tsx` | **[R]** wagmi + react-query providers |

## tests

Elevated Base railway: `src/renderer/environment/elevated-rail.ts` owns the Blender
V2 GLB, instanced supports, articulated train, headlight and lifecycle;
`elevated-rail-layout.ts` supplies metre-based curved routing and navigation footprints.
`curved-rail-geometry.ts` bends/merges the deck; `rail-city-details.ts` adds merged cable,
utility and light fixtures. Blender source: `scripts/build-elevated-rail-v2.py`;
details and budgets in `docs/base-elevated-rail.md`.
`rail-ruins.ts` owns the instanced Blender Y junction, broken southern stub and
column debris. `scripts/build-rail-ruins.py` / `pack-rail-ruins-textures.mjs`
produce its textured kit; `tests/rail-ruins.test.mjs` verifies live rail continuity,
the collapsed void, retained column coordinates and disposal.

Shared framing: `src/renderer/camera/frame-camera.ts` owns OrbitControls, saved
frame validation/persistence and player-relative composition offsets. Base and
Expedition apply them to their existing damped follow pivots; BaseApp provides
framing controls. See `docs/base-camera.md` and `tests/frame-camera.test.mjs`.

`components/base/layout.ts` defines the 64 × 54 m open construction pad used by
Base geometry, navigation and minimap. `tests/base-perimeter.test.mjs` verifies
solid paving across the former metro hole and the single retained front fence;
route/boundary checks live in `tests/base-world.test.mjs`.

Reference-building assets: `src/assets/reference-buildings.ts` (catalogue),
`src/renderer/three/cold-concrete.ts` (shared legacy/imported concrete shader and
metric UVs; re-exported by `components/expedition/cyber-concrete.ts`),
`src/renderer/three/reference-building-library.ts` (lazy GLB loading, clones,
disposal), `scripts/build-reference-buildings.py` (Blender authoring/export),
`scripts/render-reference-buildings.py` (offline review). Runtime GLBs are under
`public/game/buildings/reference-v1/`; source/metrics under `output/building-models/v1/`.
See `docs/reference-buildings.md` and `tests/reference-buildings.test.mjs`.

| File | Covers |
|---|---|
| `engine-architecture.test.mjs` | Asset registry files exist; scenes use shared loader/disposal, the shared frame loop, `src/input` movement and the follow camera rig; pure `src` layers import no three/react/components |
| `loading-screen.test.mjs` | Loading percent (warm-up, real files, never backwards, ≤ 95% until ready, wake-up pace), stages, asset labels, screen wired into base and expedition |
| `dev-tools.test.mjs` | `next.config` enables dev tools / development pages only in development; editor pages are `page.dev.tsx`; MASTER / debug / teleports are gated |
| `hub.test.mjs` | Hub links point to existing routes, artwork exists as WebP, no kit references in `public/`, hub imports no game code, game routes return to `/base` |
| `ui-kit-game.test.mjs` | Talent modules match real skill numbers for every class, effect lines, base uses the kit dialogue, character panel renders kit panels, kit tokens scoped to `.kit` |
| `camera.test.mjs` | Follow camera pivot and position are bit-identical to the legacy base / expedition / metro camera code over random frame sequences (reduced motion, portrait, MASTER zoom / pan / tree editor moves, reset); preset distances and bounds |
| `input.test.mjs` | Movement direction is bit-identical to the legacy scene formula (all key combos × stick values × dead zones × editor bindings), stick clamping, `stickVector` re-export |
| `frame-loop.test.mjs` | Frame timing equals the legacy scene loops (incl. mobile cadence cap), hidden-tab modes, stop/dispose, fixed steps and alpha, exceptions |
| `base-world`, `base-npc`, `base-quality` | Base navigation, NPC editing hooks, quality |
| `expedition`, `vegetation`, `tree-editor`, `security-fences`, `cyber-buildings`, `legacy-building-concrete` | Expedition routes/session, vegetation budget & graph, editors, catalogue budgets |
| `world-editor*` | Editor document, history, streaming, lazy loading, bundle graph exclusions |
| `world-editor-performance.test.mjs` | Changed-object reconciliation, idle bounds traversal budget, cached collisions, same-ID source replacement, fence length undo/redo |
| `combat`, `character-draft`, `mobile-performance`, `frame-throttle`, `ui-kit-preview`, `metro3d-world` | Units for the matching modules |

Offline performance tools: `scripts/benchmark-editor-nudge.mjs` measures controller
CPU work without a GPU/server; `scripts/audit-runtime-models.mjs` inventories all
public GLB/GLTF geometry, image dimensions, bytes and runtime usage. Results are
under `output/performance/`; source-model counts are distinct from repeated scene draws.

- `src/assets/base-published-layout.ts`: immutable 40-entry production Base release data.
- `components/base/published-map.ts`: release scenery hydration, collision/station transforms and library lifetime; no editor controller.
- `tests/base-published-map.test.mjs`: export parity, fresh runtime hydration and resource ownership.
- `src/renderer/environment/east-district{,-layout}.ts`: grounded east service frontage, immutable placements/boundary, Blender kit loading and teardown. `scripts/build-east-district.py` / `pack-east-district-textures.mjs` author/export its assets; `tests/east-district.test.mjs` checks ground, navigation, transition boundary and ownership. See `docs/east-district.md`.
