# Graphics and loading audit — 2026-09-24

## Scope and outcome

Owner requested a desktop graphics/performance audit and continued optimization
without replacing the game or downgrading its visual direction. Three Sol agents
reviewed assets, buildings and world rendering. Base was inspected live; Hub,
Expedition and frozen Metro were audited in source. No new production deployment
was made. Existing trailer, sword, skyline and railway work is preserved.

This pass reduces resource duplication and loading work. It does **not** establish
a universal 60 FPS result or an AAA quality/performance certification. The local
steady-frame measurement did not show a reliable FPS improvement.

## Shipped locally

1. **Lossless shared building images.** Seventeen `-shared.glb` files reference two
   byte-identical JPEGs instead of embedding them repeatedly. The ten published
   facade files plus shared JPEGs total 27,788,513 bytes, versus 32,198,512 before:
   **4,409,999 fewer bytes (13.7%)** for this subset with an empty cache. Geometry,
   unique facade art, UVs and emissive images are unchanged. This is file-byte
   accounting, not a timed download result. Originals remain failure fallbacks.
2. **One Base reference library.** Media tower, published map and development
   catalogue borrow one owner of prototypes, shared concrete/surface maps and
   signs. Borrowers no longer dispose each other's resources. Imported static
   children compose local matrices once; movable placement roots remain editable.
3. **Bounded loading.** Production prepares unique reference models with two
   concurrent requests on desktop and one on the touch profile. Placement order,
   collider construction and deleted entries remain deterministic. Loading errors
   stop new launches and settle active requests before rejection.
4. **Final-scene shader warmup.** Base waits for core world assets and saved or
   published layout, then precompiles visible materials asynchronously against
   the actual compositor output target. It reveals the canvas after the first
   completed render. It no longer renders every partially assembled light setup.
   Unmount stops input/loop immediately, while GPU disposal waits for Three's
   compile polling to settle. The hero service-rig timeout remains available.
5. **No repeated sign texture uploads.** Static sign and caption textures use a
   scrolling shader uniform. Different caption widths use separate uniforms with
   one compatible program, avoiding a shader-cache collision.
6. **GPU rain movement.** The same seeded streaks move through a shader uniform;
   positions are no longer rewritten/uploaded every frame. Rain remains enabled.
7. **Local profiling.** Development `/base?perf=1` exposes real frame cadence, CPU
   submission, nonblocking GPU timer queries, whole-frame render counts and asset
   resource timing on the canvas `data-render-profile` attribute. It pins desktop
   High during a comparison. Production cannot enable these query flags.

Previous local work already caps the wet-floor reflection at 25 Hz / 512² on
desktop, retains per-frame cinema reflections, uses 2× compositor MSAA, and stops
hero/train motion from repeatedly rebuilding the static city shadow atlas.

## Live evidence

Foreground Codex in-app browser, 1280 × 900 drawing buffer, Base High, same saved
camera and spawn, rain/reflection enabled, all counted loads settled. Source is
the canvas probe; GPU times cover reflection and postprocessing too. No build or
test process ran during the recorded settled samples. Values are short-window
snapshots, **not** a sustained hardware certification.

| Metric | Start of this pass | Final default |
| --- | ---: | ---: |
| Resident texture objects | 115 | 93 |
| Resident geometry objects | 373 | 289 |
| Shader programs | 217 | 89 |
| Frame interval P50 / P95 | 18.1 / 18.5 ms | 18.2 / 18.3 ms |
| CPU render submission P50 / P95 | 5.7 / 9.7 ms | 5.7 / 9.9 ms |
| GPU P50 / P95 | 9.49 / 12.84 ms | 10.41 / 12.21 ms |
| Whole-frame draw calls P50 / P95 | 274 / 558 | 289 / 573 |
| Whole-frame triangles P95 | 1,258,796 | 1,304,960 |

Object counts are not GPU bytes. Counters vary with moving train/robots and which
frames refresh the reflection. The data supports reduced residency/compilation
duplication; it does not support a steady-frame speedup. The FPS badge said 60,
but measured frame intervals were about 18.2 ms; do not substitute the badge for
cadence measurements. Async warmup leaves 12 more programs than the intermediate
77-program result because it also prepares currently offscreen visible materials.

The actual browser save has 47 entries, while the production layout has 40.
It was exported/saved before reload and was not replaced with production data.
Consequently live timing describes the owner's local map, not a production-map
benchmark. The published-map loader was verified through tests and build.

Final shared models use `?v=20260924-3`. Runtime image requests resolve to the two
registered `/game/textures/building-shared-v1/` URLs, returned 200, and showed
`transferSize: 0` on repeat loads. Initial development URI/cache issues were
fixed before acceptance. The loader also detects GLTFLoader's silent missing-map
case and retries the original GLB. Do not infer a single decoded ImageBitmap from
browser HTTP cache reuse: separate GLBs can still decode temporary copies.

## Experiments and decisions

- **Rain off:** 288/571 draws versus 289/573 with rain; GPU P50 about 10.37 ms.
  No meaningful improvement in this sample. Keep rain and its atmosphere.
- **Reflection off:** 288/288 draws; GPU 8.97/9.70 ms; CPU submission 4.0/4.6 ms.
  This confirms the extra scene pass matters. Reflections remain on in default
  High; removing them would change the approved night scene.
- **16 m foliage cells:** 5 global source meshes become 128 spatial batches,
  preserving all 978 instance transforms. In the representative view, draws
  increased to 308/612 while triangles fell to about 1.226 million. No reliable
  GPU win: **disabled by default**. `perfSectors=1` retains a tested development
  experiment for narrower cameras. Spatial culling is not sector asset streaming.
- **Zero-contribution local-light guard:** development `perfLights=1` preserves
  nonzero lighting and skips zero-contribution point/spot BRDF work. One sample
  was about 9.16/10.85 ms GPU, but introduced costly first shader compilation and
  has not been validated on other GPUs. **Disabled by default**; do not claim a
  general improvement or silently enable it in production.
- **Building mesh merging:** ten published facades already use 84 material draws.
  Nine have one primitive per material. Further merging offers at most one draw
  per CYBERBASE tower at the cost of broader culling bounds. Not applied.
- **Facade/Sakura KTX2:** earlier variants broke emissive advertising or blossom
  alpha. They remain disabled. The approved canal KTX2 kit/shared surface remain.

## Remaining work, ordered by measured risk/value

1. **Lighting/pass budget.** Base currently has 27 point lights, six directionals,
   a hemisphere and a spotlight in the visible tree. Profile on an integrated
   laptop GPU; compare baked/static lighting plus a small fixed dynamic light
   pool. Preserve lantern/neon appearance in identical frames. Keep the frame
   budget at 16.7 ms for 60 FPS, with headroom for gameplay; track P95, not averages.
2. **Authored LODs for expensive silhouettes.** Build and inspect lower-detail
   Sakura/architecture assets with matching materials and projected-size switching.
   Existing Expedition small-prop fade (27–44 m) is not a full building/tree LOD
   system. Do not hide nearby objects or reduce texture sharpness to claim success.
3. **Camera-aware sectors.** Choose coarser cells using actual game POV; test both
   narrow and wide saved cameras. Separate draw culling from asset residency.
   Explicit load/unload ownership, bounds, hysteresis and traversal tests are needed
   before unloading buildings. A tiny Base visible nearly all at once gains little
   from aggressive streaming; Expedition is a stronger candidate.
4. **Transparency and reflections.** Preserve alpha-tested blossom/foliage cards.
   Profile fountain spray, glows and water overdraw separately. Evaluate a simpler
   distant reflection representation only with visual comparison.
5. **Acceptance matrix.** Cold/warm production load timings, walking through all
   sectors, route re-entry memory checks, 10–15 minute laptop/phone thermal runs.
   No physical phone, integrated laptop or sustained thermal run was done here.

Source details: [assets](performance-assets-2026-09-24.md),
[building transforms/batches](performance-buildings-2026-09-24.md),
[world/Expedition/Metro audit](performance-world-2026-09-24.md).
Metro is a frozen prototype and was not modified merely because its shadow loop
has an audit finding. Hub is a CSS/image UI, not another continuously drawn 3D map.

## Verification

264 tests pass; ESLint, TypeScript and production build pass. Build routes remain
`/`, `/base`, `/expedition`, `/metro` and not-found; development editors/cinema are
absent. Tests cover asset-byte parity and URI resolution, missing image fallback,
borrowed ownership, bounded loading/error handling, static transforms, shader
uniform ownership, rain geometry, spatial matrix parity and warmup cancellation.
Live Base retained facade art/emissive windows, blossom masks, fountain and wet
reflections. Click-to-walk and camera follow worked. No new console errors after
the final cache-key fix; earlier development errors remain in the browser log.
The existing dev server and user tab are retained. No commit/push/deploy.
