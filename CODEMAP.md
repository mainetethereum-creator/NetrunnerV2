# Code map

Layer tags: **[R]** React UI · **[3]** Three.js · **[P]** pure logic (no three/react) ·
**[S]** browser storage/DOM · **[E]** engine loop. Target layers: see `ARCHITECTURE.md` §4.

## Root

| Path | Purpose |
|---|---|
| `app/` | Next.js routes (see ARCHITECTURE §1.1) |
| `components/` | Game code (legacy layout, being migrated into `src/`) |
| `src/` | New layered engine code (`assets/`, `core/loop/`, `input/`, `renderer/three/`, `ui/hub/`) |
| `lib/wagmi.ts` | Wallet (wagmi) config: Base mainnet only, `baseAccount` connector + EIP-6963 injected wallets, cookie storage, Builder Code attribution (target rules: ADR-016) |
| `public/` | Runtime assets (models, textures, atlases, draco decoder, vegetation bin, UI images) |
| `assets/fonts/Martius` | Display font (licensed, see LICENSE.txt) |
| `vendor/vegetation` | MIT tree generator used only by the vegetation editor |
| `scripts/` | Bakes (landscape, vegetation), asset audit, agent process cleanup, `import-ui-kits.mjs` (UI kit artwork → WebP), `import-hub-cards.mjs` (owner HUBB card art, titles, badges → WebP) |
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
| `src/renderer/three/gltf-loader.ts` | **[3]** `createGltfLoader()` — GLTFLoader with shared Draco decoder |
| `src/renderer/three/dispose.ts` | **[3]** `disposeObjectTree()` — dispose geometries, materials, textures once |

## app/

| File | Purpose |
|---|---|
| `layout.tsx` | Root layout, Martius font, `Web3Provider` |
| `page.tsx` | `/` → `HubApp` (hub landing page) |
| `base/page.tsx` | `/base` → `BaseApp` |
| `expedition/page.tsx` | `/expedition` → `Expedition` |
| `metro/page.tsx` | `/metro` → `Metro3D` |
| `editor/vegetation/page.tsx` | `/editor/vegetation` → `VegetationEditor` |
| `ui-kit-preview/*` | UI kit sandbox (Ghost Signal, ability matrix, `matrix-state.ts` [P]) |
| `globals.css` | Global styles + CyberBase UI kit tokens (`--cb-*`: colors, font, chamfer clip, corner lines) |

## components/base — Runner's Refuge (`/base`)

| File | Purpose |
|---|---|
| `BaseApp.tsx` | **[R][S]** Base UI: loading, NPC dialogues (`DIALOGUE`; portrait / name bar / text / replies per the Dialogue kit), orientation quest (localStorage), wallet dialog, settings (incl. return to hub), minimap/destinations, interact button, MASTER toggle, HUD |
| `BaseApp.module.css` | Base UI styles incl. touch layout; UI kit skin and NPC dialog layouts (desktop / portrait / landscape) at the end |
| `BaseEditorPanel.tsx` | **[R]** MASTER panel for the base (lazy) |
| `scene.ts` | **[3][E]** `createBaseScene`: renderer/composer/lights, refuge geometry, NPCs, GLB buildings, hero + animation + combat, input, camera, rain, quality, loop, MASTER, snapshots |
| `world.ts` | **[P]** Spawn, bounds, colliders, stations, `canStand`, `moveWithCollision`, `findPath`, `nearestStation`, editor overrides (module state) |
| `quality.ts` | **[P]** Desktop quality modes and render ratio |
| `materials.ts` | **[3]** PBR refuge surfaces (concrete/metal/stone), sky texture; shared by expedition/metro |
| `wetness.ts` | **[P]** Wetness GLSL chunk |
| `wet-floor.ts` | **[3]** Reflective puddle floor (High quality) |
| `zones.ts` | **[3]** Service street, kiosks, signs, market, lights |
| `metro.ts` | **[3]** Metro entrance pit and courtyard opening |
| `buildings.ts` | **[3]** `ArchitectureTools` type + city architecture builder |
| `district.ts` | **[3]** District builder (currently unreferenced) |
| `fence.ts` | **[3]** Concrete perimeter fence |
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
| `CharacterPanel.tsx`, `character-draft.ts` | **[R][S]/[P]** Character/inventory/talents panel, draft attributes |
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
| `lazy-editor.ts` | **[P]** Facade that loads the editor only on activation |
| `controller.ts` | **[3][S]** Selection, transforms, duplicate, delete, place, undo/redo, save/load (localStorage), JSON import/export |
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

| File | Covers |
|---|---|
| `engine-architecture.test.mjs` | Asset registry files exist; scenes use shared loader/disposal, the shared frame loop and `src/input` movement; pure `src` layers import no three/react/components |
| `hub.test.mjs` | Hub links point to existing routes, artwork exists as WebP, no kit references in `public/`, hub imports no game code, game routes return to `/base` |
| `input.test.mjs` | Movement direction is bit-identical to the legacy scene formula (all key combos × stick values × dead zones × editor bindings), stick clamping, `stickVector` re-export |
| `frame-loop.test.mjs` | Frame timing equals the legacy scene loops (incl. mobile cadence cap), hidden-tab modes, stop/dispose, fixed steps and alpha, exceptions |
| `base-world`, `base-npc`, `base-quality` | Base navigation, NPC editing hooks, quality |
| `expedition`, `vegetation`, `tree-editor`, `security-fences`, `cyber-buildings`, `legacy-building-concrete` | Expedition routes/session, vegetation budget & graph, editors, catalogue budgets |
| `world-editor*` | Editor document, history, streaming, lazy loading, bundle graph exclusions |
| `combat`, `character-draft`, `mobile-performance`, `frame-throttle`, `ui-kit-preview`, `metro3d-world` | Units for the matching modules |
