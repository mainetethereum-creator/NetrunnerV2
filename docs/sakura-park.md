# Sakura park — local visual experiment, 2026-09-20

The owner requested a living Japanese garden instead of the foreground road and
traffic, using dream-loop and Blender, with graphics matching the existing city.
This working-tree variant is not committed or deployed. The September 19
production checkpoint still serves the previous frontage.

## Scene

Ten sakuras, connected basalt paths and planted ground, a four-jet fountain,
two yatai food stalls, pole/stone lanterns, benches, rocks and ground petals.
Three delivery robots follow a continuous 190-second loop. Settings → Park
deliveries uses the previous traffic preference key. Stalls and robots are
ambience; no delivery or food-purchase gameplay was added.

Walking/collision and the minimap extend to z 34. Fountain, stalls, trees,
benches, lanterns and rocks are solid; grass remains walkable. Existing station
and metro mechanics remain intact. The garden is scene-owned, not individually
editable in MASTER. The owner's 40-entry map and saved camera were preserved;
backup: `output/map-backups/base-before-sakura-2026-09-20.json`.
Final UI export `base-after-sakura-2026-09-20.json` matches all 40 entries exactly.

Lighting combines warm lanterns with cool moon fill and Base-only facade neon.
Rain coverage extends into the garden; existing distance fog remains. Distant
diffuse lightning is suppressed under reduced motion. Rain preference persists
in `cyberbase.base.rain.v1`. Settings → Garden ambience enables synthesized city
hum, water and rain after a user gesture; audio starts off on each page load.

## Assets

Editable source: `output/sakura-park/sakura-kit.blend` (13 model roots).
Runtime: `public/game/park/sakura-v1/sakura-kit.glb`, currently 4,674,488 bytes.
Blender 5.2.1 builder: `scripts/build-sakura-park.py`; then run
`scripts/pack-sakura-textures.mjs` for embedded WebP images. Run Blender with
`--background --factory-startup --threads 4`. Bump the runtime query **after**
packing to avoid immutable browser caches. All temporary Blender jobs exit.

References, prompts and lossless source textures are in `output/sakura-park/`.
Bark, cedar, basalt, moss, blossoms, understory, washi, noren, signage and water
spray are AI-authored artwork. Normals are derived from luminance, not measured
photogrammetry scans. Models have metre-based UVs; vegetation uses depth-writing
alpha masks. The scene is actual 3D geometry, not a projected concept image.

## Runtime and performance

`sakura-park-layout.ts` owns pure placement, paths, poses and collision data.
`sakura-park.ts` instances repeated geometry/material groups in the Base loop.
`park-ground.ts` shares a path mask between paving, planting and highlights.

The west garden edge now reaches x = -42 beside ARMORY. Its three basalt path
branches continue across the former black gap, with the ground slab, moss and
plant scatter extended under them. The large sakura at (-29, 15) was removed at
the owner's marked sightline; its low planted bed and rock scatter remain.
The existing planar reflection is extended into the park; no extra reflection
pass. New point lights do not cast shadows. Mobile reduces light, vegetation and
particle counts; desktop rendering is capped at 60 FPS.

Prototypes retain shared GPU ownership; disposal is idempotent and late loads
are released. Audio closes on teardown and becomes silent in a hidden page.
Facade signs opt in only for Base libraries, including editor and published-map
loading, preserving Expedition's original assets.

## Verification and current visual limits

220 tests, lint, TypeScript and production build passed. Tests cover actual GLB
budget/materials, continuous clear robot routes, park navigation and collision,
pause behavior, shared-resource teardown, late loads and Base-only sign ownership.
Logs and screenshots are in `output/sakura-park/`.

Live inspection: 1280×720 desktop, 390×844 browser viewport, walking from plaza
into park, ambience toggle, rain/delivery settings. Visible desktop High measured
59–60 FPS / 18 ms p95, around 10–14 ms CPU submission in sampled frames,
DPR 1 / render scale 1.35. No new console errors after the corrected asset reload.
This is not a physical-phone measurement; real touch/device performance is owed.

Dream-loop scores: 4.0 → 5.1 → 5.7 → 6.0 → 6.6 → 6.6. The sixth major revision
improved branches, kiosk fronts and robot faces but introduced more visible
dotted water ripples and bounded reflection patches; fragmented crown shapes
also remain. The skill's stalled rule now asks for owner visual feedback before
more design iterations. Do not claim an 8/10 completion or a photoreal match.
