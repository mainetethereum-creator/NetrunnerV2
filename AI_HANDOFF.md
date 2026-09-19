# AI handoff — 2026-09-19

Repository: `mainetethereum-creator/NetrunnerV2`, working branch `feature/ui-kit-3d`.
Preserve the shared dirty tree. Architecture step 5 is not signed off. Owner authorized commit, push and Vercel deployment on 2026-09-19. Previous detailed handoff: `docs/archive/AI_HANDOFF-before-map-restore-2026-09-18.md`.

## Release checkpoint: publish current city (2026-09-19)

Owner explicitly requested Git + deployment and a phone-testing URL. Fresh MASTER
Save/export still contains exactly 40 entries: `output/map-backups/base-published-2026-09-19.json`.
Production previously skipped browser editor saves and would show the old map.
`src/assets/base-published-layout.ts` now carries the release data;
`components/base/published-map.ts` reuses the renderer's authored grouping,
restores transforms/deletions, NPC stations, colliders and relocated metro cut,
and loads just the placed buildings. No editor controller/UI or storage in production.
Dev continues using the owner's independent browser save. Camera save unchanged.
215 tests, TypeScript, lint and production build passed. Fresh production origin
loaded the current city, movement worked, 390×844 view and console checked. The
physical phone/touch performance check is the owner’s next step. Metro depth
visually inspected on the live map. Temporary production server will be stopped.
Git origin/main is an ancestor of the current branch; ordinary fast-forward push
is planned. Vercel Git integration confirmed by its previous successful commit status.
Local Vercel CLI token is expired; do not print it. Use the Git deployment path.

## Previous task: reveal the relocated metro stairwell (2026-09-19)

Owner requested a depression at the existing east-side metro entrance. The
stairs/retaining shell/landing already existed below the continuous city pad.
`src/renderer/environment/metro-opening.ts` clips the foundation layers, underlying service asphalt and annex ground,
stone receiver and wet-floor reflection inside the shell. Four shared world
planes follow the original metro's editor delta, including rotation/scale;
delete closes the cut and undo restores it. Existing walls, booth and steps
stay solid. Four recessed tread guide strips and a slightly stronger local
landing light make the descent visible. Navigation and sealed door unchanged.

The owner's live map had advanced to **40 entries**. Both
`output/map-backups/base-before-metro-opening-2026-09-19.json` and
`output/map-backups/base-with-metro-opening-2026-09-19.json` contain that exact
same layout. Saved/exported through MASTER; a .25 m nudge/Undo round trip
retained all entries exactly. Original `base:metro`: (25.25, -2.59, -11.5787),
yaw -360°, scale 1. Keep the owner's newer building/fence edits and camera;
the 37-entry city save below is historical.

213 tests, lint, TypeScript and production build passed. Tests cover revealed
steps/landing, unchanged service deck, transformed opening, delete/reset/Undo,
PBR material ownership and reflection clipping. Notes: `docs/metro-opening.md`.
Base/server stay open; no new helpers, commit, push or deployment.

## Previous task: city street and moving traffic (2026-09-19)

Owner replaced the abandoned-edge direction with urban infrastructure/traffic.
Fresh 57-entry live export saved before work:
`output/map-backups/base-before-city-traffic-2026-09-19.json`.
Removed only the previous task's 20 scenery IDs; retained the four buildings,
original owner entries and tall-wall deletion exactly. Current browser save:
**37 entries**, `output/map-backups/base-with-city-traffic-2026-09-19.json`.
Do not restore the older 57/32/28-entry checkpoints over it. Camera unchanged.

`src/renderer/environment/city-street.ts` adds a scene-owned street parallel to
the plaza: two opposing lanes, paving, low divider, two bus shelters and lamps.
Procedural sedan/taxi/bus batches use the existing frame loop; 24 vehicles on
desktop, 16 on the touch profile. No navigation extension or boarding/collision
gameplay. Street/traffic is not a MASTER prop; old outskirts assets stay available.
Settings → City traffic persists separately in `cyberbase.base.traffic.v1`.
Reduced-motion defaults it off; explicitly enabled ON in the owner's browser
for this request, without changing the system preference, rain or train behavior.

210 tests passed; final traffic/settings revision passed 8 affected tests, lint,
TypeScript and production build. Desktop and 390×844 browser views inspected;
viewport reset, console clean, traffic preference restored after reload. Walked
the front plaza east; final reload returned the hero to spawn. Browser
timer throttling reports ~1 FPS even while document.hidden is false, so this is
not a foreground-device FPS benchmark. Real phone performance remains unmeasured.
See `docs/city-street.md`; review images: `output/city-street-review/`.
Existing dev server and Base tab remain open. No new background helpers, commit,
push or deployment.

## Previous task: four buildings and first outskirts placed (2026-09-19)

Owner approved two corners / two slender towers and the abandoned-edge reference.
Seven Blender GLBs and a reused burning-drum composition are in both catalogues.
Builder: `scripts/build-outskirts-kit.py`; notes: `docs/outskirts-kit.md`.

Live map was **32 entries**, newer than the checkpoint below. Saved before work:
`output/map-backups/base-before-outskirts-2026-09-19.json`. All 32 entries unchanged.
Four buildings and 20 scenery objects added; tall front wall hidden and replaced
by low blocks. Latest saved map: **57 entries**,
`output/map-backups/base-with-outskirts-2026-09-19.json`. Never restore the older
28-entry checkpoint. Saved camera unchanged.

Outskirts z 12…38 is scenery. Original walking bounds and east expedition trigger
remain; no new playable zone. Fire is static in Base, two unshadowed warm lights.
Resources stay shared/library-owned. Fixed decimal wall ID import and non-solid
ground policy. 205 tests, lint and TypeScript pass. Blender helpers exited; Base
tab and existing dev server stay open. No commit, push or deployment.
Base reload/export confirms all original entries unchanged; walked the plaza to
the east exit. Both route consoles clean; Expedition catalogue tested and its
temporary tab closed. Final image: `output/building-models/outskirts-review/base-final.png`.

## Previous checkpoint: owner map saved for local Git commit (2026-09-19)

Saved through MASTER and exported the owner's latest Base layout: **28 entries**.
Authoritative latest backup: `output/map-backups/base-checkpoint-2026-09-19.json`.
This supersedes all older 16-entry snapshots below. It includes the placed parts
shop and CYBERBASE tower, repositioned Coinbase/metro, second portrait tower and
the owner's deletions. Do not import older maps over this layout. Saved camera
was not changed. Browser save confirmed; export matches the backup. Existing
dev server and game tab remain open. Owner requested a local checkpoint commit,
not a push or deployment. Previous verification: 194 tests, lint, TypeScript pass.

## Previous completed task: three approved concepts modeled and catalogued (2026-09-19)

`scripts/build-city-trio.py` creates CYBERBASE tower (6,726 tris/9 draws/28 m),
Japanese parts shop (5,496/7/10.7 m) and urban office (5,512/8/11 m) in Blender.
~3 MB per GLB, complete opaque shells, exact original image patches, shared dark
metric concrete. Sources/reviews/metrics: `output/building-models/<slug>-v1/`;
runtime: `public/game/buildings/<slug>-v1/<slug>.glb`.
Catalogue IDs: `building-cyberbase-tower`, `building-japanese-parts-shop`,
`building-urban-office`. Both editors use the existing lazy shared library.
CYBERBASE ticker is static, with a separate mesh/UV1 for later scrolling.
Office is 11 m including roof as announced before modeling; no existing building
was resized to reconcile the earlier incompatible height requirements.

No placement performed. Base saved/exported before HMR; after previews all 16
entries compare exactly unchanged, including Coinbase. Preserve current map/camera.
194 tests, full lint and TypeScript pass. Blender and Base previews inspected;
Expedition catalogue loads all three with correct metrics and no console errors.
Temporary Expedition tab closed. Base console contains only older rail HMR errors.
Temporary Blender runs exited; existing dev server and Base tab stay open.
Details: `docs/city-trio.md`.

## Previous task: three new building concepts and slightly lower railway

Three built-in imagegen previews and exact prompts are saved under
`output/building-concepts/2026-09-18-cyberbase-parts-office-v1/`: glass CYBERBASE
tower with vertical static letters, Japanese parts shop with violet neon, compact
modern office. No models created yet; scrolling text is explicitly deferred.
Office height is provisional (~11 m): the owner's simultaneous requirements
above the 13.2 m administration and below the lowered guideway conflict. A choice
was requested; no answer yet. Resolve height before modeling, not by resizing
existing buildings silently.

Rail deck lowered 60 cm from 13.2 to 12.6 m. Route/collisions unchanged; train,
supports and hanging details use the same height. Saved the current Base through
MASTER before HMR; export still matches the 16 entries in the wallet backup below.
185 tests, full lint and TypeScript pass; visible scene checked with saved camera.
Existing game tab and server remain running.

## Previous task: current map secured and railway shortened behind towers

Before railway edits, the owner's complete 16-entry Base map was saved in browser
storage and exported exactly to
`output/map-backups/base-with-wallet-tower-saved-2026-09-18.json`. The saved Coinbase
tower entry is (7.3151, -3.67, -18.769195014829442), scale 1, rotation 0; portrait
media tower is (-11, -0.92, -19), scale .8. Never restore an older 15/16-entry
catalogue checkpoint over this layout.

The elevated railway is now a short rear route: start (-16, -28.5), straight to
route distance 28, then a 35 degree/radius 32 m bend and short tangent toward metro.
It uses 8 deck spans and 4 supports at deck height 13.2 m. The three-car train starts
at route distance 42 so its static/reduced-motion composition crosses the bend.
Visual inspection confirmed the guideway sits behind both advertising towers and
the long empty approaches are gone. `Standard 2` was restored after inspection.
All 185 tests pass; affected ESLint targets and `npx tsc --noEmit` pass. The live
Base is rendered and interactive. Console history still contains resolved HMR
module-not-found messages from the instant this new layout file was first created;
there is no current error overlay.

## Latest task completed: current camera saved as Standard 2

The first valid fixed Base composition is copied once from
`cyberbase.base.camera-frame.v1` to `cyberbase.base.camera-preset-2.v1`. The new
**Стандарт 2** button restores that composition around the current runner pivot
and makes it the active persisted fixed-follow frame. Later framing changes do
not overwrite the preset. The existing **Стандартный ракурс** still returns to
Tactical follow. Map data, movement and hero scale are unchanged by this feature.

## Latest task completed: Base hero enlarged in the owner's fixed framing

The Base hero visual wrapper and loading fallback now use scale 1.4 (previously
1.25) so the runner reads more clearly in the owner's wide saved camera frame.
Movement, animation normalization, collision dimensions, marker size and camera
behavior are unchanged. The existing saved map and fixed-follow camera remain
authoritative; do not reset either during later visual work.

## Latest task completed: approved Coinbase wallet tower modeled and catalogued

Owner approved proceeding with the next building: the slim Coinbase wallet tower.
Builder `scripts/build-wallet-tower.py`; source/review/metrics in
`output/building-models/wallet-tower-v1/`; runtime
`public/game/buildings/wallet-tower-v1/wallet-tower.glb`.
7,688 triangles / 10 draws / 3,108,136 bytes; 8.2 × 7.64 × 32.74 m.
Original concept PNG embedded unchanged; shared dark concrete; one separate alpha
blended static ticker ribbon (the rest opaque). Its UV1 spans the perimeter for
later work, but scrolling still requires a ticker texture/shader. No animation or
new runtime loops/lights. Catalogue ID `building-wallet-tower`, label
«Башня Coinbase wallet · стекло и голограмма», in Base and Expedition.

An optional location question was sent. No location answer yet: catalogue only,
no replacement/placement of existing buildings. Fresh owner map exported before
integration and after Base checks; all 16 entries match exactly, including café
scale 1.3 and glass corner at (-31, .08, -1). Checkpoints:
`output/map-backups/base-before-wallet-tower-2026-09-18.json` and
`output/map-backups/base-after-wallet-tower-catalogue-2026-09-18.json`.
Camera unchanged. 184 tests, lint and TypeScript pass. Blender and Base preview
checked; Expedition catalogue loads the same 7,688-triangle/10-draw model with
correct dimensions. Both routes' console warnings/errors empty. Temporary
Expedition tab closed; owner's Base tab remains. Existing dev server reused;
temporary four-thread Blender processes exited. No commits/push/deploy.
Feature notes: `docs/wallet-tower.md`.

## Previous task: café enlarged on the current Base map

Owner found the café too small. Its saved instance now has uniform scale 1.3:
approximately 9.99 × 8.32 × 10.31 m including signs/hardware. Same position and
rotation; all other 15 entries compare unchanged. Base asset/catalogue scale is
still 1.0. No new geometry, textures or runtime code. Current map saved in-browser.
Fresh before/after exports: `output/map-backups/base-{before,with}-cafe-enlarged-2026-09-18.json`.
Visible Base inspection shows the larger façade and clear neighboring façades;
the export matches the requested scale exactly. Camera unchanged. Screenshot:
`output/building-models/japanese-cafe-v1/in-game-enlarged.png`.
No code tests rerun for this editor-only transform. Dev server and Base tab remain.

## Previous task: approved Japanese café installed instead of armory

Blender source, metrics and review: `output/building-models/japanese-cafe-v1/`.
Builder: `scripts/build-japanese-cafe.py`; runtime:
`public/game/buildings/japanese-cafe-v1/japanese-cafe.glb`.
8,334 triangles / 10 draws / 3,290,000 bytes; 7.683 × 6.4 × 7.93 m including hardware.
Same dark SECTOR 02 concrete; original approved Japanese/food artwork embedded
unchanged in individually mapped details. Counter/stools/lanterns/balcony/roof are
geometry. No new runtime lights/loops/rigs. Shared lazy library, both catalogues:
`building-japanese-cafe` / «Японское кафе · 食堂 / ラーメン».

Owner explicitly asked to temporarily replace the armory. Fresh browser export
already included the owner's newer glass-corner position (-31, .08, -1); this was
preserved. Only the armory entry's source changed to the café, retaining its ID,
position (-9.5747, .08, -9.8703), yaw 0 and scale 1. Other 15 entries unchanged.
The 16-entry layout is saved in-browser and backed up under
`output/map-backups/base-{before,with}-japanese-cafe-2026-09-18.json`.
No camera/default map changes. Armory stays in catalogue; its NPC service remains.

181 tests, lint and TypeScript pass. Blender, Base placement and both catalogue
previews checked. Reload with MASTER closed restored the café; the next exported
document matched all 16 saved entries exactly. Walked from the plaza to the café
approach with the unchanged follow framing. Both routes' console warnings/errors
were empty. In-game image: `output/building-models/japanese-cafe-v1/in-game.png`.
Temporary Expedition tab closed; owner's Base tab remains. Physical-phone
performance and owner artistic review remain. Feature notes: `docs/japanese-cafe.md`.
Existing port 3000 server PID 6568 remains; the temporary Blender process exited.
A duplicate server attempt detected the existing Next lock and exited immediately;
no extra server remains. No commits/push/deploy. Wallet tower is still concept-only.

## Previous task: Japanese café and Coinbase wallet tower concepts

Owner requested two static images before deciding on 3D: a small Japanese food
café and a slimmer tall glass tower with a looping Coinbase wallet hologram ticker.
Both concepts were generated with built-in Imagegen using the approved Glass + Neon
images as style references. The tower also uses the official Coinbase Wallet logo
as an image reference. Outputs, prompts and source notes are in
`output/building-concepts/2026-09-18-japan-wallet-v1/`:
`01-japanese-cafe.png` and `02-wallet-tower.png`.
Visuals checked: café food counter/lanterns/signs; tower's narrower silhouette,
readable repeated Coinbase wallet text, logo and wraparound transparent ribbon.
These are pending owner artistic review. The ticker is static; animation comes
later. No models, code, browser map/camera saves or server state changed. Current
Base remains the saved 16-entry layout described below. No build/tests needed for
concept PNGs and notes. Next step depends on the owner's chosen appearance.

## Latest task completed: approved second glass commercial corner

Owner authorized the second Glass + Neon concept. `scripts/build-glass-corner.py`
creates the five-sided glass/concrete shell, exact approved red/cyan media texture,
roof terrace/fans/antennas, entrance, service equipment, cables and an open-stroke
energy-cell hologram in Blender. Source and review live in
`output/building-models/glass-corner-v1/`; runtime is
`public/game/buildings/glass-corner-v1/glass-corner.glb`.
9,064 triangles / 10 draws / 3,286,492 bytes; 14.9 × 11.427 × 21.135 m.
The original second concept PNG is embedded unchanged. Concrete uses the same
shared dark SECTOR 02 material. No new runtime lights, loops or loader processes.

Both MASTER catalogues now include `building-glass-corner` / «Угловой коммерческий
корпус · стекло и реклама». A copy was placed through Base UI on the west lot at
(-24, .08, 2), yaw 90°, scale 1. The current saved map has **16 entries**; all previous
15 entries compare exactly unchanged. Fresh backups:
`output/map-backups/base-before-glass-corner-2026-09-18.json` and
`output/map-backups/base-with-glass-corner-2026-09-18.json`.
Reload with MASTER closed restored the new scene; the next UI export matched all
16 saved entries exactly. The owner's current fixed-follow camera was preserved.
This is browser authoring data, not a production default or deployed map.

178/178 tests, lint and TypeScript pass. Actual GLB tests cover source-image hash,
finite indexed geometry, closed facades, bounds/budgets and resource sharing/disposal.
Both visible catalogue previews loaded correctly; Base placement, move/rotation,
save/reload, and walking to the building were checked. Console warnings/errors were
empty on both routes. Full build not rerun for an on-demand asset registration with
unchanged bootstrap. Physical-phone performance and owner artistic review remain.

No Blender session was running; one temporary four-thread background Blender job
generated/exported/rendered the asset and exited normally. Temporary Expedition
tab closed; existing Base tab and port 3000 dev server remain. No commits/push/deploy.
Feature notes: `docs/glass-corner.md`; review image `blender-review.png`, game view
`in-game.png` in the asset's output directory.

## Latest task completed: visible camera zoom controls and dev server

Base free-framing mode now exposes large `− / +` controls alongside wheel/touch
gestures. `−` moves the camera farther from its current OrbitControls target and `+`
moves it closer; both reuse the existing 4–100 m distance limits. The buttons only
act while the frame is unlocked, so normal follow and a fixed saved composition are
not changed accidentally. The Base engine delegates the action to the shared frame
camera; Base help text and `docs/base-camera.md` describe the fallback controls.

Targeted camera tests and the full suite pass: 175/175. ESLint and TypeScript pass.
Visible `/base` verification confirmed both controls appear, each changes the rendered
view, and standard follow mode is restored afterward. The current city and camera were
not saved/reset/imported during this task. One harmless existing DirectX shader precision
warning appeared; there were no page errors. The user-requested dev server remains live
on port 3000 (Next listener PID 6568); the working Base tab is left open for continuation.

## Latest task completed: editor arrow-key stalls and model weight audit

Controller now applies transforms/collider callbacks only to changed entries, uses
indexed document lookup, caches unchanged footprints (invalidated by transform,
deletion, source/length or terrain height), and updates static selection bounds only
on selection/edits. Same-ID imports with a different source now replace geometry too.
Duplicate MASTER activation is skipped. Base collider adapters skip owners without
colliders; editor shadow invalidations coalesce at10Hz and stop when idle.

Reproducible CPU benchmark:120groups×80meshes+40props,60edits. Median4.241→.507ms,
p95 6.311→.924ms; unrelated callbacks7140→0, unrelated root updates14280→0;
idle selection bounds visits9600→0. These numbers exclude browser/GPU rendering.
Scripts and reports: `scripts/benchmark-editor-nudge.mjs`, `output/performance/`.

Audited14GLBs+32catalogue entries, including images/usage. New buildings6301–10430tri;
hero68132tri remains the heavier animated exception, not automatically decimated.
Original portrait and buildings untouched. Round props reduced: tires10368→7776tri,
hydrant7180→5280, microbus29264→27184; materials/draws unchanged, bounds within1.5cm.
Offline audit now multiplies rendered InstancedMesh triangles by instance count.
See `model-audit-2026-09-18.json`, `round-props-optimization-2026-09-18.json` and
`scripts/audit-runtime-models.mjs`. No Blender regeneration/extra process used.

174 tests, full lint+scoped lint after prop edits, TypeScript and diff checks pass.
No build required for these controller/geometry-only changes. Visible Base editor
12arrow steps+12Undo actions: no hang, rolling158–161FPS/6ms p95,2.4–3.2ms CPU submit;
short desktop sample only, no before/after FPS or phone guarantee. Console clean.
Current15-entry map exactly matches fresh before/after backups:
`output/map-backups/base-{before,after}-editor-performance-2026-09-18.json`.
Never replace it with an older backup. No camera save/reset was made by this task:
initial saved view looked away from city; user changed it while work was ongoing,
and final visible UI reports standard follow mode («Выбрать кадр»). Preserve that
current state. MASTER and performance HUD closed; existing user Base tab/server remain.

Process audit: only one port3000 server; many live MCP helpers but no confirmed
orphan parent; idle2sCPU sample did not implicate them. User-owned sessions untouched.
All transient test/audit commands completed. Extra sustained/mobile profiling remains
unmeasured, not a claim that every asset is equally low-poly.

## Previous task completed: reference alignment restored, wide curve rejected

Owner explicitly rejected the large bend around the street. Keep the main line exactly
as the photo reference, with only a small turn where it emerges behind the portrait tower.
`elevated-rail-layout.ts` now uses the original z=−15.5 / atan(.6) diagonal for distance≥12.
The tower-side bend is20° with radius28 m, length9.774 m; approach before it is straight.
Deck13.2 m,24 spans at−92+8n,9 piers at−96+24n. Right metro pier is EXACTLY back at
(22.12331748,−5.72458065). Preserve this arrangement; do not restore the rejected90° arc.

V2 Blender kit, articulated coaches, bellows, lighting and suspended service details remain.
Actual full runtime: desktop70,150tri/32draws, mobile69,526/32. No new assets regenerated.
168 tests, lint and TypeScript pass. New actual-GLB roof test clips high administration
triangles against the route corridor: max11.6 m, deck underside12.1 m, clearance.5 m.
Tests lock reference alignment/right column, joins, tower clearance and absence of old
plaza support collisions. Production build not repeated for this route-only correction.
Visible Base checked from Keeper approach; movement/follow camera work, console clean.

Fresh current map: `output/map-backups/base-reference-rail-2026-09-18.json`, identical to
`base-before-reference-rail-2026-09-18.json` and all15previous entries. No saved building or
camera edits. Screenshot `output/elevated-rail/v2/reference-alignment.png`.
Existing Base tab/server retained, MASTER closed, HUD visible. No extra processes/agents.

## Previous task: broad curved railway V2 installed (route rejected)

Owner explicitly resumed railway after the map-restoration fix. Installed the curved
route, upgraded Blender train/deck/piers, per-coach bogie alignment and flexible bellows,
headlight, hanging cable bundles, conduit, utility cabinets and warm/cyan fixtures.
Deck13.2 m, radius24 m, route begins behind the portrait tower and sweeps around the street.
26 spans/10 supports/3 coaches; speed7 m/s, coach spacing10.5 m. Support station24 moved27
to clear the saved administration. No saved building/camera transforms changed.

Runtime GLB `public/base/models/elevated-rail-v2.glb`, revision20260918-arc2, 1,016,184bytes.
Source `output/elevated-rail/v2/cyberbase-elevated-rail-v2.blend`, generator
`scripts/build-elevated-rail-v2.py`. Original user Blender file and active Scene confirmed
intact, previous review render completed and no render running.

Full runtime desktop75,122tris/32draws, mobile74,514/32. Three shadow-free lights desktop,
one mobile. Source kit25material draws; deck subdivides at2m then bends into7merged draws.
Details and contracts: `docs/base-elevated-rail.md`; ADR-034 supersedes straight V1 placement.
Unused old curve sketch under `output/elevated-rail/v2/wip/` is historical; live source is
authoritative and includes final support placement/car spacing.

167 tests, lint, TypeScript and production build passed. Real GLB budgets/contact/finite
geometry checked. 976-position coach silhouette audit found no overlaps (minimum.816m gap).
Visible Base inspected with moving train; navigation to Oracle and dialogue worked, saved
camera followed. Console errors/warnings empty. Screenshot `output/elevated-rail/v2/in-game.png`.
Physical-phone performance not measured. No new server/helper/browser process started.

Fresh before/after exports match exactly, all15entries:
`output/map-backups/base-before-curved-transit-resume-2026-09-18.json` and
`output/map-backups/base-with-curved-transit-2026-09-18.json`. Existing dev server and user
Base tab left running, MASTER closed and HUD visible for inspection.

## Previous task completed: old map appearing after reload / editor toggles

Owner stopped the curved railway work to investigate why the old sparse map reappeared.
Confirmed causes: lazy Base editor restored localStorage only on first opening; closing
MASTER cancelled asynchronous document preparation through the ghost cancellation token;
an early Save could replace storage with empty history. HMR also retained React's open
MASTER state while recreating an inactive editor.

Fixed in the existing code:
- `world-editor/controller.ts`: separate document and ghost request lifecycles; initial
  `ready` promise; awaited load/import; pending/failed save guard and snapshot state.
- `lazy-editor.ts`: shared inactive `initialize()` awaits document readiness without
  opening the panel. Import errors remain retryable; document errors report reload.
- Base scene: if a saved development map exists, wait for authored and placed models,
  apply the latest document, and only then reveal gameplay. No-save scenes remain lazy.
  Production still excludes editor code through DEV_TOOLS.
- BaseApp: synchronize MASTER with a recreated scene and remount its loading screen.
- WorldEditorPanel: disable Save/Export while restoration is pending or failed.

Validation: 162 tests, lint, TypeScript and production build passed. Tests include
deferred restoration, close/Escape/selection, early Save, failed load + retry and
superseding reset/import. Visible Base tested with close/open/close and full reload:
new buildings appeared before opening MASTER; exported document matched the pre-work
checkpoint exactly, all 15 entries unchanged. Saved follow-camera status retained;
browser error/warning logs empty. No mobile/full Expedition playthrough claimed.

## Authoritative saved owner map

Live browser map always takes precedence over any file backup. Before reload/code edits,
save/export fresh owner changes; never reset storage or import an older map automatically.

Verified checkpoint: `output/map-backups/base-reference-rail-2026-09-18.json`,
identical to `base-with-curved-transit-2026-09-18.json`,
identical to `base-map-restore-verified-2026-09-18.json`,
identical to `base-before-curved-transit-2026-09-18.json` and the previous rail-return
checkpoint: 15 entries, 6 deletions. Tower at (−11, .08, −19), uniform scale .8.
The rear NEON entry was removed by the owner. Do not restore the older 16-entry map.

Key x/z positions: ARMORY (−9.5747, −9.8703); administration (12.3706, −10.0715);
metro (24.5, −11.5787), y=−2.59; courtyard house (.5838, −10.4924);
remaining NEON (−20.5199, −11.9723); directorate (10.4113, −34.018).
Restaurant is available in the catalogue but absent from this checkpoint.

Storage key `cyberbase.world-editor.base.v1` now automatically loads on development
Base startup; opening MASTER is no longer required. Map JSON is browser-local, not a
production map publication. Camera is separate: `cyberbase.base.camera-frame.v1`.
Preserve its chosen framing and player-follow behavior.

## Environment and continuing safely

Existing dev server on port3000 and user's visible IAB tab1 were reused and retained.
Final tab `/base`, MASTER closed, latest buildings present, saved camera intact.
No extra servers/browser tabs/helpers launched. Test/build processes finished.
Do not stop user-owned Blender or dev server. Run heavy checks sequentially.
Feature notes: `docs/base-map-editor.md`, `docs/base-camera.md`, `docs/base-elevated-rail.md`,
`docs/media-tower.md`, `docs/reference-buildings.md`. Physical-phone performance and older
architecture checks in ROADMAP TD-02 remain owed.
