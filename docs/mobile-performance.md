# Expedition mobile rendering and controls

Implemented for coarse primary pointers and `any-pointer: coarse` hybrids, including mouse-plus-touchscreen devices and phones in landscape above the old 650/700 px media breakpoints. The same CSS and renderer-profile conditions include a no-hover fallback for phones up to 700 px wide or up to 1100 × 500 px in landscape. Narrow mouse-only windows retain the desktop renderer. The pure `usesTouchProfile` helper selects the renderer path once at scene creation; it does not rebuild the renderer when input devices change. The virtual stick has one captured pointer, a radial dead zone, equal diagonal speed, and release/cancel/lost-capture/blur/visibility/modal resets. The four combat buttons remain separate touch targets for movement plus skill use. Inventory and other secondary controls expand from one menu button. The HUD stays in CSS at native browser resolution; only the WebGL drawing buffer scales. Safe-area offsets and dynamic viewport heights keep controls within the viewport.

## Render budget

- Start with DPR capped at 1.7 and about 1.1 million drawing-buffer pixels on common phones. The previous mobile path could reach DPR 2 / 2.8 million pixels.
- Every two seconds, sample visible gameplay frame cadence. Exclude loading, the editor, dialogs, and long one-off stalls. This measures scheduling plus rendering, **not GPU timing**.
- Warmup and cooldown windows suppress load-time reactions. Two slow windows lower target scale by 0.07; actual scale moves only 0.025 per 600 ms. Floor: 72% of initial resolution, with an absolute DPR floor of 0.75. Materials, lighting, fog, tone mapping, near geometry and texture source resolution are preserved.
- Recovery requires twelve healthy windows (24 seconds) and adds only 0.035. Sustained load at the floor eventually selects a 30 fps presentation cadence for the rest of that visit. This deliberately avoids repeated thermal recovery/overload cycles. Hidden documents cancel animation frames entirely, then reset timing/input before resuming.
- Target 60 fps, fallback cadence 30 fps. Neither is a measured device guarantee; a CPU or GPU bottleneck may remain below the target. There is no browser thermal-sensor claim.

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
