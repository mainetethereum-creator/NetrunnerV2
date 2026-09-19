# Building quartet and first outskirts — 2026-09-19

**Superseded scenery direction:** ADR-037 replaces the placed outskirts with a
city street and traffic; the four buildings and all catalogue models remain.
Current map is the 37-entry city save; see `city-street.md`. The 57-entry export
below is historical and must not overwrite a newer browser map.

Owner approved the two corner / two slender tower concepts and the abandoned
city-edge reference. Images: `output/imagegen/building-references-2026-09-19/`.
`outskirts-approved.png` is a copy of the attached owner image.

Builder: `scripts/build-outskirts-kit.py` (Blender, four CPU threads, sequential
renders, private scenes). Sources/reviews/metrics: `output/building-models/<slug>-v1/`.
Runtime GLBs: `public/game/buildings/<slug>-v1/<slug>.glb`.

| Slug | Triangles | Draws | Width × depth × height, m |
|---|---:|---:|---|
| corner-chamfer | 5,228 | 7 | 9.93 × 8.84 × 11.61 |
| corner-rounded | 6,720 | 8 | 10.88 × 8.76 × 11.61 |
| slender-glass | 8,556 | 7 | 6.68 × 9.22 × 36.91 |
| slender-terrace | 8,244 | 7 | 6.68 × 9.34 × 34.31 |
| outskirts-wreck | 1,238 | 5 | 2.10 × 4.50 × 1.55 |
| outskirts-barrier | 108 | 3 | 3.14 × 0.76 × 1.08 |
| outskirts-ground | 7,058 | 7 | 64 × 26 × 0.82 |

Building IDs have `building-` prefixes; other IDs match their slugs. Both MASTER
catalogues use the existing lazy reference library and shared GPU resources.
Shells, frames, roof hardware, terraces and stairs are geometry; window interiors
use rectified approved-image patches. Rooms are not enterable. Pale tower concrete
retains its own material; other concrete uses the shared dark material. Ground is
non-solid through import/transform/undo. Asphalt has irregular road shoulders and
a portable aggregate/crack texture.

`burning-drum` reuses the drum/campfire with one unshadowed warm point light.
Campfire geometry remains city-library-owned and disposes once. Two fires placed.
Fire is static in Base; no new frame loop, smoke or flickering system.

## Placement and preservation

Saved/exported the live **32-entry** map before work, newer than the previous
28-entry checkpoint: `output/map-backups/base-before-outskirts-2026-09-19.json`.
`scripts/place-outskirts-kit.mjs` reproduces these additions over that checkpoint:

- Corners on side lots (-20, 1) and (26, -2.6), fully inside the platform.
- Towers at (-25, -33) and (7, -37), behind shops and clear of the guideway.
- Ground at (0, 25): x -32…32, z 12…38, outside the original platform.
- Three wrecks, two fire barrels, spare barrels, tires, bags and roadblocks.
- Tall front wall hidden; six low blocks leave a broad central gap.

Latest saved browser map and backup: **57 entries**,
`output/map-backups/base-with-outskirts-2026-09-19.json`. All original 32 entries
unchanged. Camera untouched. Local development authoring only, no production
default or deployment. Existing east expedition interaction and Base walking
bounds remain. Outskirts is a first scenery pass, not a playable zone.

## Verification

205 tests, full lint and TypeScript pass. Tests cover real GLB bounds/indices/UVs,
closed facades and budgets, owner-map preservation, railway clearance, non-solid
ground after edits and single disposal of shared fire buffers. Blender reviews
inspected. Base save/reload restored 57 entries and exact comparison confirmed all
32 original entries unchanged. Walked across the plaza to the east exit with the
saved follow camera. Adjusted corners to fit entirely on the platform. Expedition
catalogue loaded the glass tower, ground and fire barrel with expected metrics;
both route consoles were clean. Temporary Expedition tab closed, Base/server kept.
Final screenshot: `output/building-models/outskirts-review/base-final.png`.
Phone performance unmeasured. No production build needed for catalogue/editor changes.

Fixed pre-existing import rejection of decimal-coordinate authored wall IDs:
accept them only when they exactly name a registered source. New prop IDs retain
the strict pattern. No commit, push or deployment.
