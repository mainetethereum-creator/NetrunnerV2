# Architecture Decision Log

Newest decisions at the end. Never rewrite an accepted ADR; supersede it.

---

## ADR-001: Netrunner is the CyberBase codebase; refactor in place
**Status:** accepted (2026-09-14, owner)
**Decision:** The existing Netrunner game is the product. No replacement project,
no parallel skeleton, no migration into a separate repository. Architecture work
happens incrementally inside this repository. Existing maps, assets, gameplay, UI
and controls must be preserved.
**Reason:** the game already works and contains months of content; rebuilding it
would lose working behaviour. (A separate `D:\V2 Cyber\CyberBase` monorepo was
created by mistake and is paused.)
**Consequences:** every refactor step must keep the game running and visually identical.

## ADR-002: Strangler-style migration into `src/` layers
**Status:** accepted
**Decision:** New engine layers live in `src/` (`core`, `gameplay`, `world`, `input`,
`renderer`, `ui`, `assets`, `shared`). Legacy `components/` modules are moved or
wrapped one concern at a time; scenes become thin composition. Routes stay in `app/`.
**Reason:** small, reversible steps; each commit is reviewable and testable.
**Consequences:** for a while both structures coexist; `ARCHITECTURE.md` §4 maps old → new.

## ADR-003: Boundaries are enforced from the first commit
**Status:** accepted
**Decision:** `eslint.config.mjs` forbids `src/{core,gameplay,world,input,shared}` and
`src/assets/registry.ts` from importing `three`, React/Next or legacy `components/`,
and forbids any `src/` file from importing `components/`. `tests/engine-architecture.test.mjs`
checks the same without relying on lint.
**Reason:** layering degrades quickly without automation, especially with several AI agents.

## ADR-004: Three.js becomes the renderer layer gradually
**Status:** accepted
**Decision:** Three.js code is concentrated in `src/renderer`. Gameplay state
(player position, heading, velocity) moves out of Object3D into gameplay state that
the renderer reads. Until then, adapters wrap the existing scene code.
**Reason:** today Object3D is the source of truth, and gameplay reads it directly.

## ADR-005: Shared asset registry
**Status:** accepted (stage 1)
**Decision:** Runtime asset URLs are declared in `src/assets/registry.ts` (plain data)
and loaded through shared helpers (`createGltfLoader`). A test verifies registered files exist.
**Reason:** URLs were hardcoded and duplicated; dead references went unnoticed.
**Consequences:** remaining hardcoded paths (atlases, materials, vegetation, UI images,
animation donors) move into the registry in later steps.

## ADR-006: Loop, input and camera are extracted before gameplay state
**Status:** accepted
**Decision:** Order of work: loop wrapper → input → camera → hero animation → player
state → typed events → renderer bootstrap → map data → editor → UI → ECS-style systems.
**Reason:** the first extractions are mechanical and identical in all scenes, so they
remove duplication with low risk and make the later state changes smaller.

## ADR-007: No big ECS rewrite
**Status:** accepted
**Decision:** Introduce component/system structure only where it simplifies real
systems (interactables, enemies, loot) after player state and map data are extracted.
**Reason:** the owner asked not to rewrite for ECS; current systems are small.

## ADR-008: Maps become data after visual parity is guaranteed
**Status:** accepted
**Decision:** Base and Expedition layouts are extracted to `content/maps` / `content/prefabs`
piece by piece, verifying identical visuals with before/after screenshots at fixed
camera positions. No new or placeholder maps.
**Reason:** layouts are currently code and colliders are duplicated separately.

## ADR-009: Editors stay dev tools outside the gameplay graph
**Status:** accepted
**Decision:** MASTER and the vegetation editor remain lazily loaded dev tools;
tests keep asserting they are not in the static gameplay import graph. The future
map editor edits `content/maps` JSON and is excluded from production builds.

## ADR-010: Git workflow for the refactor
**Status:** accepted
**Decision:** Work on `refactor/engine-architecture`. Commit e153744 snapshots the
pre-existing uncommitted work; each architecture step is a separate commit.
No pushes or merges without the owner's request.

## ADR-011: Test-importable modules use explicit `.ts` imports
**Status:** accepted
**Decision:** Modules in `src/` (and any module imported by `node:test` suites) use
relative imports with `.ts` extensions (`allowImportingTsExtensions` is enabled).
**Reason:** tests run with Node's type stripping and no bundler, which cannot resolve extensionless imports.

## ADR-012: One frame loop with fixedUpdate → update → render
**Status:** accepted (step 2)
**Decision:** `src/core/loop/frame-loop.ts` schedules frames for all scenes. It owns
requestAnimationFrame, hidden-tab handling (`stop` for base and expedition, `skip`
for metro — each scene's previous behaviour), the mobile cadence cap (`targetFps`),
the 0.05 s delta clamp, and the phases `fixedUpdate × N → update → render` with an
interpolation `alpha`. Scenes pass `updateFrame` (everything before the render call)
and `renderFrame` (render, stats, snapshot). Base stops the loop on WebGL context loss;
expedition keeps running as before.
**Reason:** the same loop existed three times; one tested loop is the seam for a
fixed-step simulation.
**Consequences:** `tests/frame-loop.test.mjs` proves frame timing equals the old code on
identical timestamps. Scenes do not use `fixedUpdate` yet: while Object3D is the source
of truth there is no interpolation, so fixed steps would stutter on high-refresh
displays. Movement adopts it in step 6.

## ADR-013: Movement input layer
**Status:** accepted (step 3)
**Decision:** `src/input/movement-input.ts` (`createMovementInput`) stores held keys and
the on-screen stick and resolves them into a camera-relative world direction with the
scene's dead zone (base 0.12, expedition and metro 0.1) and key bindings
(`MOVE_KEYS`, or `EDITOR_PAN_KEYS` with Q while the expedition MASTER editor pans).
`stickVector` moved to `src/input/touch` and is re-exported from its old module.
Scenes keep what is gameplay or scene policy: when movement is allowed (ready,
paused, modals, editor, session status), walk/run speeds, which keys are captured
with `preventDefault`, and action keys (E, Space, 1–4, I, H).
**Reason:** the same key/stick/azimuth formula existed three times; input needs one
owner before camera and player state are extracted.
**Consequences:** `tests/input.test.mjs` proves the direction is bit-identical to the old
formula. The metro stick is now clamped to [−1, 1] and non-finite values become 0 like
in the other scenes; `Metro3D.tsx` already sends clamped finite values, so nothing
changes in play.

## ADR-014: UI kits as React + CSS; hub at `/`, refuge at `/base`
**Status:** accepted (owner request, 2026-09-14)
**Decision:** The CyberBase Hub, in-game HUD and Dialogue kits are integrated as React
components with CSS frames. Only artwork without baked text ships, cropped and compressed
to WebP in `public/ui` by `scripts/import-ui-kits.mjs`; references and layout grids live in
`docs/ui-kits`. Kit PNGs with baked text or placeholder quality are rebuilt in CSS. The hub
is the landing page `/` (`src/ui/hub`, no game code imported); Runner's Refuge moves to
`/base`, and expedition, metro and the vegetation editor return to `/base`.
**Reason:** the kits require separate layers, text rendered by code and three layouts
(desktop, mobile landscape, mobile portrait); the zips are ≈ 66 MB of mostly duplicated
PNGs, the imported runtime artwork is ≈ 0.5 MB; the hub must open without loading Three.js.
**Consequences:** old links to `/` now open the hub (PLAY and the Base card lead to `/base`).
Updated kits are re-imported with the script; `tests/hub.test.mjs` guards routes, artwork and
the absence of references in `public/`.

## ADR-015: One entry into the game from the hub
**Status:** accepted (owner, 2026-09-14) · supersedes the Base / Metro hub cards of ADR-014
**Decision:** Player flow is wallet → hub → PLAY → base → expedition or metro (from the base).
The hub links into the game only through PLAY (`/base`); the Base and Metro cards are removed
on desktop and mobile. The Base card artwork stays as the hub backdrop (`backdrop.webp`).
**Reason:** jumping from the hub straight into the metro skipped the base, which is the game's hub
for expeditions and the metro.
**Consequences:** `tests/hub.test.mjs` fails if a hub item links anywhere but `/` or `/base`.

## ADR-017: Hub backdrops per layout
**Status:** accepted (owner, 2026-09-14) · replaces the backdrop part of ADR-015
**Decision:** The hub uses three owner-provided backgrounds — desktop, mobile landscape and mobile
portrait — stored as `public/ui/hub/backdrop-{desktop,landscape,portrait}.webp` at the full source
resolution (1672 × 941 / 941 × 1672), WebP quality 92. CSS assigns one per breakpoint, so a device
downloads only the backdrop it shows. The Base card crop is no longer used.
**Reason:** owner art for the hub; q92 is visually lossless (identical to the PNG at 2× zoom) at
≈ 290 KB per image, while strictly lossless WebP would be ≈ 1.6 MB each.
**Consequences:** URLs live in `ASSET_URLS.ui.hubBackdrop`; to change a background, overwrite the file
with the same settings (see `docs/ui-kits/README.md`).

## ADR-018: Hub feature cards from the owner's HUBB set
**Status:** accepted (owner, 2026-09-15) · supersedes the kit card crops of ADR-014
**Decision:** Season 1, SkyNet and NFT Collection cards follow the owner's reference
(`HUBB/референс.png`): clean background art (`feature-*.webp`), a thin CSS frame in the card tone,
the owner's textured title artwork and "coming soon" badges (`title-*.webp`, `badge-*.webp`) with
`role="img"` labels carrying the same text, and small texts (brand, tagline, top-right line,
coordinates) rendered by React. Sizes use container units, so the composition is identical on desktop,
portrait and landscape; small landscape cards show only title and badge. The framed HUBB card images
are not used because their baked neon frames would force a fixed card shape.
**Reason:** owner design for the cards; the titles are artwork by request, so the kit rule "no baked
text" is relaxed for them while labels keep the text accessible.
**Consequences:** `scripts/import-hub-cards.mjs` re-imports the set. Images are cached for 30 days
(`next.config.ts`), so replaced artwork must get a new file name (this is why the backgrounds are
`feature-*` and not the old `card-*`).

## ADR-019: Development tools never reach players
**Status:** accepted (owner, 2026-09-15) · makes ADR-009 enforceable in production
**Decision:** The MASTER map editor (base and expedition: props, trees, landscape panels), the
expedition debug panel and test teleports (`?debug`, `?van`, `?fence`, `?vegetation`), the vegetation
generator page and the UI kit preview page are development tools.
- Editor pages are `app/**/page.dev.tsx`. `next.config.ts` adds the `dev.tsx` page extension only in
  the development phase, so production builds contain no such routes (players get 404).
- `next.config.ts` bakes `CYBERBASE_DEV_TOOLS` into the bundle: `"1"` in `next dev` (or in a build started
  with `CYBERBASE_DEV_TOOLS=1`), otherwise `"0"`. `BaseApp.tsx` and `Expedition.tsx` render editor and
  debug UI only when `DEV_TOOLS = process.env.CYBERBASE_DEV_TOOLS === "1"`; the constant is local to each
  file, so the production build compiles that UI out.
- Systems players see stay: landscape and grass rendering, baked vegetation, the lazy editor seams in
  the scenes (never triggered without the UI).
**Reason:** the production deployment showed the MASTER button and the editor pages to players.
**Consequences:** `tests/dev-tools.test.mjs`. New development pages use `page.dev.tsx`; new editor or
debug UI checks `DEV_TOOLS`.

## ADR-020: The game lives in its own repository, NetrunnerV2
**Status:** accepted (owner, 2026-09-15) · supersedes the branch rule of ADR-010
**Decision:** The game's git history moves to `github.com/mainetethereum-creator/NetrunnerV2`. Its
`main` is the former `refactor/engine-architecture`, which contains the whole Netrunner history since
2026-09-09. The repository `mainetethereum-creator/cyberbase` (the cyberbase.fun site, whitelist and
the older 2D BitMap line, with an unrelated history) is no longer a remote of this folder. The mistaken
`D:\V2 Cyber\CyberBase` monorepo and the agent scratch folders `.dream-loop` and `.cache` were moved to
the Recycle Bin.
**Reason:** the owner wants the new 3D game kept apart from the website, the whitelist and the old game.
**Consequences:** `origin` is NetrunnerV2; commits go to `main`, pushed only on the owner's request.
The Vercel project `netrunner-cyberbase` is connected to NetrunnerV2 (`vercel git connect`, on the
owner's request), so a push to `main` deploys production.
Game branches left in the old `cyberbase` repository are deleted only on the owner's request.

## ADR-021: Scene loading screen — pixel helmet, red eyes, real progress
**Status:** accepted (owner, 2026-09-15)
**Decision:** Base and expedition show `src/ui/loading/LoadingScreen.tsx` while the scene loads,
replacing the old "A light left on for you." screen (metro keeps its own).
- Art: the owner's 400×400 pixel helmet, split by `scripts/import-loading-helmet.mjs` into the helmet
  with its eyes off on a transparent background (`public/ui/loading/helmet.webp`) and a red eye layer
  (`eyes-red.webp`); red was chosen by the owner.
- Sequence: darkness → a light sweep over the helmet and flickering eye ignition → eyes breathe and
  blink → eyes flare at 90–100% → eyes close and the screen dissolves into the scene.
- Progress is real: files counted by three.js' `DefaultLoadingManager`
  (`src/renderer/three/loading-progress.ts`, imported lazily so the screen itself does not pull
  Three.js). `loading-model.ts` adds a short warm-up while code downloads, never moves backwards, stays
  ≤ 95% until the scene is ready, and keeps the wake-up visible on fast cached loads.
- Animation runs on CSS variables from one requestAnimationFrame loop that stops when the screen is
  gone; reduced motion removes the sweep, flicker, blink and float.
**Consequences:** `tests/loading-screen.test.mjs`. A cyan variant only needs a recoloured eye layer.

## ADR-016: Wallet-first access, EVM wallets, Base as the primary chain
**Status:** accepted as a product rule (owner, 2026-09-14) · **not implemented yet**
**Decision:**
- **No guest mode.** The player connects a wallet before entering the hub. Without a connected
  wallet the hub, `/base`, `/expedition` and `/metro` show only the connect screen.
  Flow: connect wallet → hub → PLAY → base → expedition or metro.
- **Wallets:** Coinbase Wallet / Base Account, MetaMask, Rabby, OKX Wallet and other EVM wallets.
  Browser extensions are discovered through EIP-6963 (already enabled); mobile wallets without
  an injected provider need WalletConnect (to be added).
- **Chain:** Base mainnet (chain id 8453) is the primary gameplay chain. A wallet connected on
  another network is asked to switch to Base before entering. Onchain transactions keep the
  Builder Code attribution configured in `lib/wagmi.ts`.
**Current state (2026-09-14):** `lib/wagmi.ts` configures only Base, the `baseAccount` connector and
EIP-6963 discovery. Guests can still enter: the hub wallet menu says "play as a guest" and the base
wallet dialog says "Explore freely as a guest".
**Open questions for implementation:** WalletConnect project id; development testnet (e.g. Base
Sepolia); how local development and automated browser checks reach gated routes without a real
wallet (a development-only path that production builds exclude); session persistence (wagmi cookie
storage is already on).
**Consequences:** when implemented, guest texts and paths are removed, the connect screen becomes the
entry to `/`, and tests assert that gated routes require a connected wallet on Base.

## ADR-022: One follow camera for all scenes
**Status:** accepted (step 4, 2026-09-15)
**Decision:** `src/renderer/camera/follow-camera.ts` (`createFollowCamera(preset, pivot)`) owns the
isometric follow camera: pivot damping (8/s, instant with reduced motion), the optional snap below
1e-6 m² (base only), portrait distance below aspect 0.85, the camera position formula, MASTER wheel
zoom, expedition MASTER pan and tree editor focus, and "Reset camera". Per-scene numbers are presets
(`BASE_CAMERA` 25/32 with zoom 28 in [8, 65]; `EXPEDITION_CAMERA` 22/28 with zoom 22 in [5, 42] and
pan 12 m/s in 0..144 × 0..72; `METRO_CAMERA` 22/28). The module has no three.js import: the scene's
own `Vector3` is the pivot (editors and streaming keep reading `pivot`), the scene passes
`camera.position` to `place` and still calls `camera.lookAt(pivot)`. Scenes keep the follow target
(base `player.y + 0.93`, expedition `player.y + 1`, metro fixed `y = 1`) and when to follow.
**Reason:** the same camera code existed three times; one tested owner is needed before hero
animation and player state are extracted.
**Consequences:** `tests/camera.test.mjs` proves pivot and camera position are bit-identical to the old
code on random frame sequences. Browser checks for this step are owed (`ROADMAP.md` TD-02).

## ADR-023: Extend the existing refuge as a lightweight night district
**Status:** accepted (owner request, 2026-09-17)
**Decision:** preserve the courtyard, original buildings, hero, NPCs and all expedition mechanics.
Add a west-side district through a real opening in the concrete perimeter. Author new layered
shop-houses/stalls/train in Blender MCP using the existing building atlas; share materials and
instance repeated meshes. Keep far-city detail in one compressed image card plus low-detail
parallax silhouettes. No extra NPCs, full-city simulation, postprocessing pipeline or frame loop.
**Interaction:** armory opens existing Inventory; implants opens the existing Talent Tree preview;
noodles enable an optional city sound bed. No fabricated economic/health/upgrade mechanic.
**Camera/accessibility:** Base defaults to a more open City framing; Tactical keeps the old rig.
Rain and train motion respect reduced-motion defaults, with explicit settings overrides. Audio
is disabled by default and starts only after user activation; hidden tabs suspend it.
**Resource ownership:** Base owns teardown. GLB source kit keeps shared resources alive; repeated
apartments/stalls/carriages use instancing; skyline late-load callbacks guard disposal. No new
window event channels. Owner requested the final development preview remain running; no deploy.

## ADR-024: Opt-in third-person camera experiment in the Base
**Status:** accepted (owner request, 2026-09-17)
**Decision:** add a separate orbit/boom camera, not replace the shared isometric rig or change
the map. City remains default; a minimap-side button, Settings and V cycle City / 3rd person /
Tactical. Switching clears movement/path input. Reset positions the camera behind the hero.
Mouse/touch drag orbits; short taps retain pathfinding. Wheel zooms, WASD/stick remain relative
to the current view. No automatic yaw chasing that would cause lateral movement to spiral.
**Cost/limits:** FOV 58, zoom 2.2–9 m; <=45 reused-point footprint probes per update, no mesh
raycasts, assets, lights or render passes. Contract immediately at walls; ease only the return
(instant with reduced motion). Conservative 2D footprints also shorten around low props;
near-body rendering hides the hero visual below a 0.65 m boom to avoid interior clipping.
This is an experimental Base viewpoint, not a completed third-person conversion of the game.
Expedition, Metro and MASTER retain their original cameras; mobile feel needs real-device QA.

## ADR-025: Add an ARPG comparison mode and robust Base WASD
**Status:** accepted (owner request, 2026-09-18) · extends ADR-024's mode cycle
**Decision:** City → 3rd person → Tactical → ARPG. The new Base-only composition has a fixed
50° pitch, 45° azimuth, 38° perspective FOV, 18/24 m Near/Far distances, ×1.2 in portrait.
These are our tuning values, not asserted Diablo IV internals. It uses the existing damped pivot
and respects reduced motion, has no mouse orbit, added geometry, render pass or frame loop.
Distance switches are available under the minimap and in Settings. City remains the load default.
**Input:** Base normalizes physical WASD/arrows/Shift identically on keydown and keyup, so Russian
ЦФЫВ works and a keyboard-layout change cannot strand a held movement key. Movement reclaims
canvas focus from ordinary HUD/camera buttons; text entry, modals, composing text and Ctrl/Alt/Meta
shortcuts remain protected. V also recognizes physical KeyV without intercepting Ctrl+V.
**Scope:** same map, collisions, movement speeds, click paths, mobile stick and original modes.
No wall fading added in this iteration; tall foreground geometry may still obscure the hero.
MASTER, Expedition and Metro are unchanged. This is a camera comparison, not a refactor step.

## ADR-026: Keep Tactical only after the owner's camera comparison
**Status:** accepted (owner, 2026-09-18) · supersedes camera choices in ADR-023/024/025
**Decision:** keep the original Tactical camera, unchanged. Remove City framing, third-person
and ARPG rigs, their UI state, mode/V switches, Near/Far controls and obsolete experiment tests.
The night district, skyline, train, rain and audio remain; only alternative cameras are removed.
Preserve physical WASD/Russian-layout support and HUD-focus recovery introduced during ADR-025.
The shared camera parity tests remain the source of truth. No scene replacement, no deployment.

## ADR-027: Restore the original Base surroundings, keep only IMPLANTS
**Status:** accepted (owner browser annotations, 2026-09-18); supersedes ADR-023 environment.
**Decision:** remove the added distant city, neighbouring apartments, viaduct/train, west roads,
armory, food stalls, street furniture and city ambience. Restore original walking bounds,
west wall, station list, minimap and rain. Keep only the marked green IMPLANTS facade at its
original position, with its original materials and signs. It is decorative beyond the west wall;
do not retain a navigation target in removed walking space. Load a standalone extracted GLB,
not the entire abandoned district kit. Source assets/backups remain recoverable on disk.
Tactical and physical WASD remain unchanged. No hero/Expedition rollback, push or deployment.

## ADR-028: Authoring controls for the existing Base scenery
**Status:** accepted (owner request, 2026-09-18).
**Decision:** extend MASTER in place to select/delete/transform existing Base scenery and
place its pristine templates from the catalogue, alongside existing prop assets. Buildings,
planters, terminals and six wall runs are composite objects, not individual triangles.
Hero, weather, station triggers and logical navigation boundaries are not authoring objects.
Keep undo/redo, browser-local documents and JSON; do not overwrite the user's saved layout.
Retain labelled pre-merge sources only in development; lazy editor reconstructs them and
re-batches compatible instances when closed. Authored collider overrides replace original
footprints; decorative floor copies remain traversable. Copied NPCs/terminals are decoration,
not additional quest/service registrations. No production editor, new game, push or deploy.

## ADR-029: Extend Base north behind the owner's placed buildings
**Status:** accepted (owner browser comment, 2026-09-18).
**Decision:** expand the existing refuge north, moving the back fence from z=-11.6
to -23 and extending the adjoining side runs, pavement, foundation, reflections,
walkable bounds and minimap. Keep the front courtyard, metro opening, west gate,
expedition breach and annex in place. Move background scenery behind the new
perimeter. Preserve owner building transforms and saved editor layout; retain
wall IDs. This targeted extension supersedes ADR-027's original north boundary,
without restoring the rejected city district or adding gameplay stations.

## ADR-030: User-selected follow framing on Base and Expedition
**Status:** accepted (owner request, 2026-09-18).
**Decision:** retain Tactical follow as default, add explicit manual orbit/pan/zoom
and a camera frame saved per browser. Owner clarification: lock angle, distance
and composition, while continuing smooth player follow on Base and Expedition.
Store position/look-target offsets relative to the player pivot and migrate old
world-space frames without changing their Base spawn composition. Resume editing
in place; returning to the standard preset clears the saved frame. Suppress movement/placement input while
framing and resolve runner movement relative to the selected view after locking.
This supersedes ADR-026's camera-choice restriction for gameplay framing; it does
not restore the removed third-person or ARPG camera modes.

## ADR-031: Reference-driven elevated railway on Base
**Status:** accepted (owner image/request, 2026-09-18).
**Decision:** add a new Blender-authored low-poly transit line matching the supplied
image: diagonal elevated concrete platforms, illuminated columns and a dark three-car
train passing above the administration/metro side. Preserve the owner's buildings and
camera. Use instanced modules, the approved concrete shader and the existing frame loop;
provide colliders only at the column feet. This explicitly supersedes ADR-027's railway
removal for this new feature; the rejected district is not restored. No boarding,
new stations, editor-map mutation, audio, deployment or production push.

## ADR-032: Open the Base perimeter for continued city construction
**Status:** accepted (owner browser annotations, 2026-09-18) · supersedes ADR-029 boundaries.
**Decision:** keep only the marked front concrete fence line. Remove the west, east and north
concrete runs and their breach rubble. Replace the old yard/annex split with one continuous
64 × 54 m tiled construction pad (x −32…32, z −42…12), including the obsolete metro hole and
the former east-side void. Extend the structural slab, wet-floor receiver, walking/pathfinding
bounds and minimap to the same rectangle. The metro assembly remains a movable MASTER object;
the owner's saved object transforms and camera frame remain untouched. This creates space for
continued city authoring without adding stations, restoring the rejected district, or deploying.

## ADR-033: Implement the first approved glass media tower
**Status:** accepted (owner concept selection, 2026-09-18).
**Decision:** model and install the first glass/neon tower in Blender, preserving the
approved woman's image and style. Embed the original concept PNG unchanged, with
projective facade UVs; use actual low-poly construction for the body and equipment.
Place one default, editable tower on the Base rear east lot and expose the same
asset in both MASTER catalogues. Preserve existing map/camera saves and walking
routes. Second building implementation waits for a subsequent owner request.

## ADR-034: Curved reference railway with articulated rolling stock
**Status:** accepted (owner reference/request and explicit resume, 2026-09-18).
**Decision:** replace ADR-031's straight diagonal with a smooth elevated route emerging
behind the existing portrait tower and sweeping around the street. Preserve the owner's
latest building positions and saved follow framing; keep the reference height13.2 m.
Use Blender V2 train/deck/support prototypes, bend the deck into merged material batches,
pose each rigid coach on its own pair of bogies, and add flexible links, headlights,
route lighting, hanging cables and utility fixtures. Keep support-foot colliders aligned,
bounded low-poly budgets, shared scene-loop ownership and mobile lighting reductions.
The railway remains source scenery, with no new gameplay station or boarding mechanic.

## ADR-035: Restore the reference railway, restrict the bend to the tower approach
**Status:** accepted (owner correction, 2026-09-18); supersedes ADR-034 route geometry.
**Decision:** the wide street-sweeping arc is rejected. Restore the original diagonal
above administration/metro and its right-hand support positions. Keep only a small20°
bend at the portrait-tower approach, joining the reference main span smoothly. Preserve
the13.2 m height, saved buildings/camera and V2 train/lighting. Validate actual roof
clearance instead of moving the whole guideway in front of the buildings.
