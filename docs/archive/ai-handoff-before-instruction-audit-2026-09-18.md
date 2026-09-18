# Historical handoff — archived 2026-09-18

This is a historical snapshot. Current instructions and state are in the root
AGENTS.md and AI_HANDOFF.md; superseded requests below are not active directives.

# AI handoff — 2026-09-18 · Base MASTER scenery editing

## Latest owner request — open construction pad (ADR-032)

The Base floor/foundation/reflection/navigation area is now one continuous 64 × 54 m
rectangle (x −32…32, z −42…12). The obsolete metro cut-out and east-side void are
filled with the existing stone paving. Only the front concrete fence at z=11.35 remains;
all west/east/north concrete fence runs and their rubble were removed. The compact minimap
now fits the full new bounds. Owner browser-local layout and saved camera were preserved;
opening MASTER after refresh restored the moved buildings and metro.

Validation: 151/151 tests, lint, TypeScript and production build pass. Browser confirmed
the saved layout, sealed old metro opening, continuous side paving and retained front fence.
The existing user tab/dev server were reused and left available. No commit/push/deploy.

Read AGENTS.md first. Repo mainetethereum-creator/NetrunnerV2; branch feature/ui-kit-3d.
No commit, push or deploy. Architecture step 5 remains NOT signed off.

## Latest request — elevated train matching the owner's image

Implemented a new Blender kit and Base line; see `docs/base-elevated-rail.md` and
ADR-031. Runtime `elevated-rail.ts` / `elevated-rail-layout.ts`; public GLB revision
20260918-4, dedicated editable `.blend` under `output/elevated-rail/v1`. Diagonal
yaw=-atan(.6), origin z=-15.5, deckY14.9, 13.8m columns (offsetlocalz=-3,
7.5m cantilever caps) and a 3-car train at7m/s.
Ground footprints integrated into Base world navigation. 23 draws /31,314 tris.
Original Blender Scene/file preserved; no server started.

Owner changed the Base layout before this request: administration12.3706,-10.0715,
metro24.5,-11.5787, courtyardbuilding0.5838,-10.4924; restaurant removed; background
residence-6.4446,-23.2863 (scale1,.9,.3), directorate10.4113,-34.018. Saved through
MASTER and exported JSON before code reload; do not revert to the older layout below.
Browser confirmed diagonal pier beside administration/metro and clean console.
Final fitting moved only the background NEON residence to z=-28 via MASTER,
then clicked Save (UI confirmed). Its earlier z=-23.2863 intersected the train.
151 tests, lint, TypeScript and production build passed. Existing visible Base
shows the elevated route and moving cars without console errors. Phone hardware
performance was not measured; instancing and no railway shadows apply on mobile.

## Latest request — free camera and fixed frame on Base

Owner clarified that locking means fixed framing while FOLLOWING the hero,
on both Base and Expedition. Implemented shared saved position/target offsets
relative to a body pivot; old saves migrate from Base spawn (0,1.05,5). Both
scenes keep their original damped follow logic; Expedition uses the selected
Base frame and retains its own editor pan/zoom. UI now says «Ракурс сохранён ·
следуем за героем» and reset is «Стандартный ракурс». 144 tests, lint and tsc
pass, including cross-map placement, preserved pan/angle/distance and migration.
Visible browser: clicked walking destinations on both maps; hero stays at the
same screen anchor while scenery translates, with the selected angle/distance.
No console errors. Returned to Base and restored the owner's saved editor layout.
This supersedes the world-fixed behaviour described in the original history below.

Added manual OrbitControls framing (left rotate, right pan, wheel zoom; touch
orbit/pinch), fixed world camera and browser persistence under
`cyberbase.base.camera-frame.v1`. Button at bottom-left; «За героем» resets to
Tactical and clears saved frame. Runtime module is `src/renderer/camera/frame-camera.ts`;
docs in `docs/base-camera.md`, ADR-030. Input is cleared/blocked while framing;
after lock, movement uses actual camera azimuth. Existing follow rig unchanged.
Follow-up: owner requested locking their selected composition and a larger hero.
Clicked «Зафиксировать кадр» before any reload, preserving their exact view.
Base hero visual wrapper and fallback now scale by 1.25; navigation/collision
and shared animation normalization are unchanged. Reload visibly restores
«Камера зафиксирована». 142 tests, lint and TypeScript pass again.

## Current owner request — expand Base behind the buildings

Back fence moved from z=-11.6 to -23, side runs extended; courtyard pavement to
-23.7, walking boundary -22.4. Shared constants in `components/base/layout.ts`.
Foundation, reflection and minimap follow the new bounds; service background and
neighbour buildings move behind the perimeter. Front yard/metro/breach unchanged.
Wall IDs retained. Owner layout (armory at -9.5747,-9.8703; restaurant at
0.6341,-9.759; moved IMPLANTS at -7.75,-15.3) was read by UI JSON export, backed up
by the export download and saved via the UI before page refresh. Do not reset it.
140 tests, lint and TypeScript pass, including north navigation, boundary collision,
real pavement raycasts preserving metro hole and fence-corner overlap.
Visible `/base` checked after refresh: owner buildings restored, north fence
selected at z=-23, paved space visible behind restaurant/IMPLANTS. Selection
cleared and MASTER closed for the owner. No new console errors after refresh
(one earlier Object3D.add log at 22:14 UTC predates the final scene). Existing
server/tab reused, no processes started. Physical phone testing not repeated.

## Reference building assets — parallel owner request, 2026-09-18

Three Blender low-poly props from the owner's selected V1 images are integrated
into the shared Expedition/Base catalogue: armory, Chinese restaurant, central
administration. Base selector now puts them first under «Новые здания · V1».
They are catalogue assets, not new default map placements. On the owner's latest
feedback, replaced bright generic concrete with a bake from the narrow balcony
house / SECTOR 02 atlas, and reduced administration to 60% on each axis
(13.26 × 8.04 × 13.2 m). A further owner-requested darker tone scales only the
concrete tint to 75% linear reflectance. GLB cache revision is `20260918-5`.
Owner then reported a stretched/blotchy texture. Runtime now replaces only the
imported concrete with the exact legacy shader/original atlas, with UVs projected
in metres, original bump, roughness and joints. Shared implementation moved
unchanged to `src/renderer/three/cold-concrete.ts`; old import path re-exports it.
The portable Blender bake is retained for external export, not used in-game.
Translucent editor ghosts retain shader hooks when materials are cloned.

See `docs/reference-buildings.md`. Reproducible scripts are
`scripts/build-reference-buildings.py` and `scripts/render-reference-buildings.py`;
editable source is `output/building-models/v1/cyberbase-buildings-v1.blend`.
Standalone GLBs remain 6,301 / 10,430 / 9,174 triangles and 7 / 8 / 7 draws.
The loader prepares models asynchronously before placement/import, with
cancellation and disposal guards. No new services, interiors or game mechanics.

Validation after shared-concrete correction: 137/137 tests, lint and TypeScript pass.
Owner explicitly performs the in-game visual check; do not drive their open game
tab. Existing dev server and original Blender scene were reused and preserved.
Concurrent Base editor/camera/rollback work below is unrelated and preserved.

## Current request completed (ADR-028)

Owner asked to delete/place any Base map object. MASTER now exposes original scenery:
buildings including IMPLANTS, six wall runs, floors, metro, planters, lamps, terminals,
crates and surface details. Select/click → Delete; catalogue → place → ground click;
Ctrl+Z/Y, transforms, duplicate, browser-local save/load and JSON are retained.
Composite assets edit as a whole. Hero/weather/service triggers/logical bounds are protected;
copies of NPCs and terminals are decorative, not additional gameplay service registrations.

New lazy modules: `components/base/{base-map-editor,editable-render,editor-colliders}.ts`.
The scene retains labelled pre-merge sources in DEV only; the adapter reconstructs logical
groups on first MASTER use, keeps vegetation instanced and re-batches gameplay proxies on
close. World collider overrides track authored deletion/movement; non-solid catalogue copies
(floors, decals, NPCs) do not block walking. Original source constants are not changed.
Pristine templates remain placeable after originals are removed. Save loads on opening MASTER,
not a production map publish. Read `docs/base-map-editor.md` before extending this feature.

Verified: 135/135 tests, lint, tsc, production build. Live browser tested IMPLANTS deletion,
keyboard Ctrl+Z restore, catalogue crate placement/click selection, undo and MASTER close.
All temporary edits undone; no browser save/reset/storage clearing. Existing tab 3/server
reused. Old module-not-found console messages are from mid-edit HMR before the new module
was created, not the final scene. Physical phone/full Hub+Expedition manual regression owed.

Concurrent reference-building/PropPreview/async catalogue work appeared in the shared tree;
preserved its changes to `prop-assets.ts`, `PropPreview.tsx`, controller, registry, scripts,
GLBs and tests. Do not revert or claim those models as this task's output. Pre-existing hero
extraction also remains untouched. No commit/push/deploy or refactor-step signoff.

## Previous environment decision still applies (ADR-027)

Browser marker 1 rejected the new background city/roads/houses. Marker 2 selected the green
IMPLANTS building, not the armory. Restore the old Base environment; retain that building only.

- Restored original courtyard/west perimeter, walking limits, nine stations, original minimap,
  rain count/opacity/placement, camera far plane 140.
- Removed runtime district roads, armory, food stalls, apartments, skyline, viaduct/train,
  lanterns, city audio and their terminals/settings. No replacement game/map.
- Retained IMPLANTS at (-20.5,.08,-8), its original geometry/textures, two cyan signs and one
  unshadowed light. Static scenery outside the restored west wall, no unreachable station.
- src/renderer/environment/implants-building.ts loads the dedicated registered GLB, with
  disposed/late-load guards and scene-owned teardown. No per-frame update.
- Standalone GLB extracted losslessly from the Blender kit by scripts/extract-implants.mjs:
  6,972 triangles, six mesh/material groups, ~1.03 MB. Original kit/backdrop/builder retained
  on disk but not loaded by the game. Old runtime/audio/layout and audio-test text backups:
  ignored .dream-loop/removed-district/. Recoverable if requested.
- Tactical-only camera and physical WASD/Russian ЦФЫВ support preserved (ADR-026). No V/mode
  switch. Close MASTER for player movement. Mobile stick/tap/Shift remain unchanged.

## Previous rollback verification

121/121 tests, lint, TypeScript and production build passed. Former district walking targets
are rejected; original station path tests and 6000-frame-per-scene camera parity pass.
Visible existing browser shows restored courtyard/perimeter and the retained green facade,
without city/rail/market. An initial extraction texture-reference error was fixed; final reload
has no asset error notice. GLB includes both the WebP extension image and core texture source;
URL revision avoids stale cached assets, and the asset test verifies image-buffer references.
The live dev log includes transient module-not-found errors from mid-edit HMR, not the final page.

## Process and dirty tree

Reused existing localhost:3000 devserver (listener PID 28608/session 29847) and preview tab 3.
No new server/browser/Blender helper started. Keep the owner-requested preview available.
Do not clear browser storage or reset their editor data. Physical-phone touch/performance remains owed.

Pre-existing hero extraction in components/{base,expedition,metro3d}/scene.ts and
src/renderer/animations/hero/, next-env.d.ts, .claude/ and output/ are outside this rollback.
Preserve unrelated edits. No architecture refactor step, branch switch or deploy authorized.
