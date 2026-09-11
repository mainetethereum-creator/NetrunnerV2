# GrassSystemThreeJS integration

Source: https://github.com/achrefelouafi/GrassSystemThreeJS (commit b236b2a38d9f35daa2ddc7b0152544b10e635d0c). MIT license retained in LICENSE.

The playable expedition adapts `src/grass.js` directly: segmented strips, circular curl and analytical blade normals, simplex FBM coverage, world gust/flutter, color gradient, base occlusion and backlight. Each editable patch is a single instanced draw with distance visibility and at most 8,000 blades; no standalone demo, models or cinematic postprocessing are shipped. Ground elevation is an instance attribute rebuilt from the same CPU field used by movement and the soil mesh. Hidden blades collapse fully, including wind.

`noise.ts` retains the upstream Ashima simplex/FBM and Worley functions. Soil shading adapts upstream warped two-scale Voronoi crack channels and FBM moss/moisture masks. Terrain uses the upstream broad mound × finer drift formula with deterministic CPU value noise, a radial patch falloff and protected road/building/tree pads. Mesh vertex normals shade the actual terrain. Surface textures are procedural; no upstream multi-megabyte texture pack is copied.

MASTER → Ландшафт exposes spatial patch selection/outline, X/Z/radius, soil color, moss coverage, moisture, crack amount, grass density/height/curl/wind, mound height/scale/fine relief/seed. This is an adapted Soil Studio subset: moss is a surface layer, and texture-map authoring, separate crack depth controls, snow and cinematic sky settings are not included. Eight authored editable patches provide varied soil and grass; three have modest mound relief. Road asphalt and baked GitHub trees remain.

Save/load uses the `netrunner.landscape.v1` localStorage key. Saves load on scene creation; reset restores authored defaults without overwriting the saved configuration until Save is clicked. User props are re-grounded during streaming; static structure pads and roads remain fixed. UI pointer/keyboard events are isolated from gameplay.

## Release runtime changes

Gameplay now uses committed `landscape-authored.ts`, with scene-owned exact terrain and navigation caches. MASTER drafts load only when its landscape panel opens; they are not production configuration. The panel can export JSON for `scripts/bake-landscape.mjs`. Each patch now has four 750-blade chunks, frustum culling, distance density LOD and mobile quality scaling. Distant soil skips its expensive detail branch. See `docs/expedition-runtime-budget.md` for the complete runtime/authoring boundary, asset counts, mobile policy and remaining validation.
