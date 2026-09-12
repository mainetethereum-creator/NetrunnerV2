# Expedition rendering and asset budgets

Implementation inventory, mobile strategy updated 2026-09-12. These are source/asset counts, not measured device frame rates. Browser, build, lint and gameplay validation are a separate release step.

## Runtime and authoring

- `landscape-authored.ts` is the committed release configuration. Each `makeWorld()` owns a cloned landscape state, protected pads, terrain cache and navigation cache. Disposal never resets another scene.
- Terrain uses exact coordinate memoization (up to 100,000 samples), with revision invalidation after edits. Ground, grass, movement and routing use the same scene height function. Collision lookup uses 8 m spatial buckets; route walkability is cached. Height values are not rounded or quantized, so slope thresholds retain the authored behavior.
- The production path does not instantiate MASTER's prop library, ghosts, outline or localStorage drafts. The prop editor and React preview panels load on demand. Landscape outline and draft loading occur only on entering its authoring mode; rendering shares the landscape module but does not execute authoring commands.
- MASTER saves remain browser drafts. To promote landscape changes, export configuration in its panel, run `node scripts/bake-landscape.mjs <export.json>`, review the resulting source diff, then follow the project's deployment policy. No deployment is performed by these scripts.
- Custom prop bounds are added to scene-owned relief/grass pads on authoring changes. Existing static structure, road and tree pads remain protected. Custom props retain their prior collision behavior.
- Gameplay loads `public/vegetation/runtime-trees-v1.bin` and never reads vegetation editor localStorage. After intentionally updating the committed vegetation JSON, regenerate with `node scripts/bake-runtime-vegetation.mjs`. The bake indexes identical float32 position/normal/color tuples; it does not simplify trees or change their colors. The source JSON remains available to the vegetation editor.

## Mobile strategy

- Touch profiles include coarse primary pointers and `any-pointer: coarse` hybrids. A no-hover fallback covers phones up to 700 px wide in portrait or up to 1100 × 500 px in landscape. The renderer chooses its path at scene creation; CSS uses the same conditions for the stick and compact HUD. A narrow mouse-only window keeps the desktop rendering path.
- Mobile starts at DPR capped to 1.7 and about 1.1 million render pixels on common phones. Visible gameplay frame cadence is sampled in two-second windows, excluding loading/editor/dialog periods and long one-off stalls. Warmup and cooldown windows prevent reactions to brief fluctuations. Two slow windows lower target scale by 0.07; actual resolution moves only 0.025 per 600 ms, with a floor of 72% of initial resolution and absolute DPR floor 0.75. UI remains native CSS.
- Recovery requires twelve healthy windows (24 seconds) and increases target scale by only 0.035. Sustained load at the floor selects a 30 fps presentation cadence for the rest of the visit; the normal cadence is capped to 60, including high-refresh screens. Hidden documents cancel animation frames and reset input/timing before resuming. These are cadence targets, not measured phone FPS or thermal guarantees. See `mobile-performance.md` for the full controller and validation notes.
- Mobile uses the existing antialiased direct renderer. It no longer allocates unused half-float composer/bloom render targets. Desktop keeps its prior exposure, bloom, pixel budget and lighting.
- Each patch has four spatial grass chunks with conservative bounds and hardware frustum culling. Distance smoothsteps reduce density from 1 to .65 to .3 over 16–28–42 m. The mobile quality multiplier smoothly changes from 1 near the player to .8 over 16–32 m, preserving full near density. Patch capacity stays 3,000 blades total; chunk density reduction retains deterministic spatial distribution. There are at most 32 grass draws for the eight default patches before visibility culling.
- Small authored decorative props retain full detail within 27 m, fade over 27–44 m with opaque screen-door coverage, then skip their draws. Buildings/trees retain their silhouettes and geometry. Distant authored groups receive frustum culling; nearby offscreen shadow casters remain available. Streaming runs at 10 Hz. Mobile keeps four local lights and 1024 VSM soft shadows, refreshed at 10 Hz during motion and about 1.4 Hz at rest. Vegetation/street litter share an atlas texture; trilinear mipmaps and capped mobile anisotropy preserve surface stability.
- Distant soil skips expensive FBM/Voronoi detail beyond 42 m from the camera. Crack detail fades from 22–42 m. Near soil keeps the detailed material.

## Asset audit

`node scripts/audit-expedition-assets.mjs` generates `.cache/expedition-asset-audit.json` without a browser or WebGL. It constructs catalogue geometry with texture/canvas stubs and counts triangles, attribute/index bytes and material draws. Texture memory is reported separately below. Detailed current catalogue counts are in `expedition-asset-counts.json`.

| Asset | Previous triangles | Current triangles | Current geometry bytes |
| --- | ---: | ---: | ---: |
| Microbus | 280,048 | 29,264 | 1,390,272 |
| Tyre stack | 16,704 | 10,368 | 494,784 |
| Garbage bags | 10,530 | 4,818 | 130,476 |
| Blue drum | 3,560 | 1,848 | 49,104 |
| Kerosene pair | 7,252 | 3,828 | 103,480 |
| Tyre/debris pile | 12,104 | 7,448 | 213,360 |
| Hydrant | 9,408 | 7,180 | 212,424 |

The microbus previously consumed 26,884,608 geometry bytes. Tiny tread/trim boxes now use flat boxes, larger rounded boxes use one bevel subdivision, and merged buffers are indexed. Windows, wheel-arch openings, body panels, interior, weathering and material batches remain. Cylindrical prop subdivisions were reduced where their projected size is small.

All ten architectural catalogue models are 5,122–33,744 triangles each, under the 35,000-triangle large-building budget. Small catalogue props are 562–10,368 triangles per composition, with 1–8 material draws; large buildings have 6–12. Geometries are shared across authored placements. These are low-poly compositions, not one-draw objects. The three new reference-built cyberpunk models each use seven material draws; see `cyber-buildings.md` for their exact bounds, budgets and authored positions.

The seven earlier buildings reuse the same metric cold-concrete shader in existing material bucket 0. Their triangle counts and 6–12 material draws are unchanged; geometry buffers grow from 6,565,828 to 7,319,620 bytes (+753,792) for surface coordinates and distinct per-part UVs. There are no additional texture requests or new geometry parts. Plaster, brick, steel and window materials retain their original atlas tiles. The combined library owns the single downloaded atlas; its shared cyber sublibrary does not dispose that borrowed texture.

| Existing GLB | Triangles | Transfer bytes | Decision |
| --- | ---: | ---: | --- |
| city-gate | 2,956 | 223,976 | Retain |
| oracle | 11,444 | 848,348 | Retain |
| outlaw-refuge | 14,640 | 1,097,464 | Retain |
| workshop | 9,296 | 708,372 | Retain |
| shoot animation mesh | 422 | 172,100 | Retain |
| neon-sentinel Mixamo hero | 68,132 | 3,391,124 | Retain rig/animation; within 75,000-triangle hero budget |

Three tree variants retain 5,148 / 5,132 / 5,141 triangles and shared instanced geometry. Their runtime binary is 669,536 bytes versus the 3,413,012-byte authoring JSON, including no unused grass model. Counts above are uncompressed on-disk transfer sizes; server HTTP compression can reduce actual transfer.

The two 1,254 × 1,254 PNG atlases now have lossless WebP runtime copies: microbus 3,645,785 → 2,679,906 bytes; city props 3,452,534 → 2,499,408 bytes. Source PNGs remain available but are no longer requested by these renderers. No atlas pixels were resampled or changed. GPU RGBA storage with mips is approximately 8 MiB per atlas; UV tile textures now share the atlas `Source` instead of creating one GPU image per tile. Material/building atlases use the same source-sharing fix. WebP compression alone does not reduce decoded GPU memory.

## Validation still required

The reference look, grass/detail fades, smooth resolution changes, touch/hybrid controls in both orientations, soil fade, MASTER draft restoration/selection, custom pad editing, movement, route slopes, combat, and separate-scene lifecycles need browser/gameplay validation. Physical mobile devices must establish actual frame time and thermal behavior. The detailed animated hero remains the largest GLB; skinned decimation was deliberately avoided to preserve animation. No FPS claim or production deployment is implied by this inventory.
