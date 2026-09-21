# Expedition mobile rendering and controls

## Base page (`/`)

The base reuses `MovementStick`, the compact `GameHud`, and the same touch-profile,
DPR and cadence helpers below. Its existing camera-relative movement and collision
solver receive the stick vector. Opening a base dialog or HUD panel clears keyboard,
stick, click destination and captured pointer state; blur, visibility changes,
pointer cancellation, lost capture, disabling the stick and viewport resize also
reset the stick. Hidden tabs stop animation frames. Context loss stops the loop and
keeps it stopped until reload.

Touch Auto starts with direct rendering, the existing Lite reflection setting,
a static 1024 VSM city shadow plus a cheap runner contact shadow, reduced rain and
anisotropy capped at four. Walking no longer refreshes the full city shadow atlas.
Postprocessing buffers are created only if High is
explicitly selected. Desktop rendering and the High/Lite selector remain available.
The mobile DPR starts at the shared 1.7 / 1.1-million-pixel budget, moves gradually
toward the shared adaptive scale, and settles at the shared 30 FPS fallback under
sustained load. Measurements exclude loading, modal dialogs and individual stalls;
an unresolved asset request stops excluding samples after 30 seconds, while each
late asset completion adds another two-second settling window. The statistics panel
reports DPR, resolution scale and cadence target separately from measured FPS.
Base movement and collision now run at a fixed 60 Hz simulation step. The rendered
runner and its camera anchor interpolate between simulation states, preventing an
irregular browser frame from turning directly into a larger movement jump. Mobile
facade canvas uploads run at 4 Hz instead of the desktop 12 Hz.
The Base mobile profile also uses 160 rain streaks, 90 fountain droplets, 700
settled petals, 30 steam points, one real stall light, and no canal mist or moving
runner point light. Emissive materials and the fountain/canal lighting remain.

The touch base map collapses to a 44 px button with a scrollable destination list.
The single nearby-station action sits above the controls in portrait and between
them in short landscape. Dialogs layer above all controls; safe-area offsets and
dynamic viewport height apply to the touch layout.

Validation for this base integration: lint, TypeScript, production build and all 46
existing tests passed. A local production browser smoke check loaded the base with
no console warnings/errors, verified click-to-move and explicit High, and exercised
the settings/map UI at 390 × 844 and 844 × 390 in a mouse-only browser. This browser does not expose touch emulation: real joystick
movement, simultaneous touch, portrait/landscape layout and sustained phone FPS
still need a touch-capable browser or physical-device acceptance pass.

Implemented for coarse primary pointers and `any-pointer: coarse` hybrids, including mouse-plus-touchscreen devices and phones in landscape above the old 650/700 px media breakpoints. The same CSS and renderer-profile conditions include a no-hover fallback for phones up to 700 px wide or up to 1100 × 500 px in landscape. Narrow mouse-only windows retain the desktop renderer. The pure `usesTouchProfile` helper selects the renderer path once at scene creation; it does not rebuild the renderer when input devices change. The virtual stick has one captured pointer, a radial dead zone, equal diagonal speed, and release/cancel/lost-capture/blur/visibility/modal resets. The four combat buttons remain separate touch targets for movement plus skill use. Inventory and other secondary controls expand from one menu button. The HUD stays in CSS at native browser resolution; only the WebGL drawing buffer scales. Safe-area offsets and dynamic viewport heights keep controls within the viewport.

## Render budget

- Start with DPR capped at 1.7 and about 1.1 million drawing-buffer pixels in portrait. Landscape receives up to 1.45 million pixels and keeps at least 1× DPR, preventing an immediate sharpness drop when browser chrome collapses after rotation. The previous mobile path could reach DPR 2 / 2.8 million pixels.
- Every two seconds, sample visible gameplay frame cadence. Exclude loading, the editor, dialogs, and long one-off stalls. This measures scheduling plus rendering, **not GPU timing**.
- Warmup and cooldown windows suppress load-time reactions. Two slow windows lower target scale by 0.07; actual scale moves only 0.025 per 600 ms. Floor: 55% of initial resolution, with an absolute DPR floor of 0.6. This gives the 60 FPS target more headroom before the stable 30 FPS fallback. Materials, lighting, fog, tone mapping, near geometry and texture source resolution are preserved.
- Recovery requires twelve healthy windows (24 seconds) and adds only 0.035. Sustained load at the floor eventually selects a 30 fps presentation cadence for the rest of that visit. This deliberately avoids repeated thermal recovery/overload cycles. Hidden documents cancel animation frames entirely, then reset timing/input before resuming.
- Target 60 fps, fallback cadence 30 fps. Neither is a measured device guarantee; a CPU or GPU bottleneck may remain below the target. There is no browser thermal-sensor claim.

## Staged asset optimization

Stage 1 (2026-09-21) is an offline inventory only; it does not change the approved
map, camera, materials or source pixels. Run it with:

`node --experimental-strip-types scripts/audit-runtime-models.mjs output/performance/model-audit-2026-09-21.json`

The corrected inventory marks Sakura, canal, east district and rail ruins as
always-loaded Base scenery. Those core models, the hero, railway and built-in Base
buildings total about 22.95 MiB of source GLB transfer and an estimated 173.21 MiB
of decoded RGBA8 textures with full mip chains. The ten unique reference-building
models in the published owner layout add about 30.71 MiB of source transfer and
186.64 MiB of decoded texture estimates; media tower is present in both sets, so
the combined unique estimate is about 341.18 MiB before external textures, render
targets and driver overhead. This is an upper-bound source-image estimate rather
than a WebGL memory measurement, but it identifies texture residency as the first
asset target. Sakura is the largest core contributor at about 45.96 MiB, followed
by the canal kit at 33.96 MiB and the hero at 32 MiB.

Stage 2 proves the KTX2/Basis path on the external canal normal map. The reproducible
`npm run assets:ktx2:canal` task encodes the 1024 px source as mipmapped UASTC with
normal-map tuning, RDO and Zstandard supercompression. Transfer size falls from
1,081,320 to 931,734 bytes. On the usual ASTC/ETC2/BC targets its mip chain occupies
about 1.33 MiB of GPU texture blocks instead of roughly 5.33 MiB as RGBA8. Base tries
KTX2 on desktop and mobile and falls back to the unchanged WebP on a load/transcode
failure. The pinned three.js transcoder files are served locally from `/game/basis/`.

This pilot benefits both device classes. Mobile receives the larger practical gain
because memory bandwidth and GPU memory are tighter; desktop also downloads less and
keeps a smaller resident texture. No device-specific material or visual setting is
introduced. Before applying this to the embedded Sakura/canal/building textures,
compare the water at close and oblique angles on a physical phone and desktop.

Stage 3 applies the pipeline conservatively to the Sakura GLB. Four normal maps use
UASTC with normal-map tuning; seven opaque/display maps use maximum-quality ETC1S.
The three silhouette-critical alpha maps (`understory`, `water-spray`, `blossoms`)
remain their exact WebP payloads after an all-KTX2 experiment showed that converting
masked foliage was not a safe visual tradeoff. The mixed model keeps the same 49
nodes, 36 meshes, 17 materials, transforms and UVs. Its transfer grows from 4,674,488
to 5,356,748 bytes while estimated resident texture memory falls from about 45.96 to
about 29 MiB on common compressed GPU targets. Runtime tries the mixed model first
and falls back to the complete original GLB on any KTX2 or model-load failure.
`npm run assets:ktx2:sakura` reproduces the optimized copy.

The increase in transfer is accepted for this stage because the reported phone issue
is sustained rendering/memory pressure rather than first-load time. Measure both on
the physical phone before extending KTX2 to more garden alpha maps. A same-camera A/B
between the optimized model and forced WebP fallback showed the same foreground
silhouette; a clean optimized reload produced no new fallback or WebGL errors.

**Runtime correction (2026-09-21):** a later owner view exposed opaque square
cards across the Sakura canopies. Base therefore loads the approved original WebP
GLB directly again. The generated mixed KTX2 copy remains an offline experiment
and must not be re-enabled until multi-angle foliage QA passes.

Stage 4 applies the same mixed policy to the canal kit. Six normal maps use UASTC,
seven opaque/display maps use maximum-quality ETC1S, and the foliage cutout remains
its exact WebP. The optimized model preserves every node, mesh and material. Its
transfer grows from 4,461,080 to 5,745,080 bytes because it now contains mip chains,
while estimated resident texture memory falls from about 33.96 MiB to roughly
13–15 MiB on common compressed GPU targets. Runtime tries the optimized kit first
and falls back to the original GLB. `npm run assets:ktx2:canal-kit` reproduces it.

Stage 5 deduplicates the repeated 1024 px `surface` map used by 17 city-building
GLBs. Published buildings now replace their identical embedded maps with one shared
244,274-byte mipmapped ETC1S KTX2 texture after load. The original embedded JPEGs
remain as a compatibility fallback, so initial transfer/parse cost is unchanged;
steady-state GPU residency for the ten unique buildings in the owner layout drops
from roughly ten RGBA8 mip chains (about 53.3 MiB) to one compressed mip chain
(about 0.7 MiB on ETC-capable targets). Unique facade artwork, signs and emission
maps are unchanged. `npm run assets:ktx2:building-surface` reproduces the shared map.

## Scene work

- Small authored props under 3.5 m retain full geometry within 27 m and use an opaque screen-door detail fade over 27–44 m, then skip their draws. This is a detail-to-culled LOD, not a low-poly replacement for buildings or trees. It preserves silhouette-bearing buildings, fences and containers, plus all close materials. Shader hooks/program keys are composed and material variants reused. No transparent crossfade duplicate is drawn. Frustum culling skips distant authored groups while nearby offscreen shadow casters stay available.
- Preserve existing instanced trees/litter/grass and merged material batches. Static authored transforms no longer recompute their local matrices each frame. Fire animation uses a pre-collected mesh list instead of traversing every visible building.
- Stream/cull at 10 Hz. Reuse camera targets, joystick state and enemy/light lists. Nearest lights use bounded insertion instead of copying/sorting all sources. Modal presence is cached outside the render loop.
- Near grass keeps authored density; distance smoothsteps lower far density. Existing shader wind animation remains on the GPU. Sparks have a conservative animated bounding sphere and are disabled away from fire sites.
- Keep the existing mobile direct render path (no bloom/postprocess render targets), four local lights, VSM soft shadows at 1024. Refresh mobile shadows at 10 Hz during motion and about 1.4 Hz when stationary. Sun/ambient/emissive lighting and PBR response remain intact.
- Share one decoded atlas/texture between world vegetation and street litter. Keep trilinear mipmaps and cap anisotropy at 4 on mobile for environment surfaces. Existing prototype geometry/material reuse remains; there are no new per-frame texture uploads or material clones. Transparent fire/glass remains stylistically intact; detail fades add no blending passes.

## Validation handoff

Implementation agent intentionally did not run validation. `tests/mobile-performance.test.mjs` covers dead zone/diagonal speed, invalid samples, cooldowns, anti-thrashing, gradual recovery, floor/fallback behavior, and phone aspect-ratio budgets.

Use `/expedition?debug` and DEBUG for drawing-buffer DPR/scale, cadence target, sampled frame time, draw calls, triangles, textures, geometries and LOD/frustum culled props. Render counters include shadow work when the shadow map refreshes, so compare multiple windows at identical positions. Memory counts are object counts, not measured GPU bytes. Validate on physical medium phones for sustained 10–15 minute runs, alongside portrait/landscape/browser chrome/safe-area behavior, multi-touch skill use, tab switching, modal resets, near grass/materials, faded props, shadow refresh and WebGL errors. Browser emulation cannot substantiate device FPS or thermal claims.
