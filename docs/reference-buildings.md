# Reference buildings V1

Three owner-selected concepts from `output/building-concepts/2026-09-18-v1/`,
authored in Blender as exterior game props. No functional shop or accessible
interior is added by placing them.

## Catalogue

Available in Expedition MASTER under Buildings and in Base MASTER under
**Каталог → Новые здания · V1**:

- `building-reference-armory` — Оружейный · ARMORY V1
- `building-reference-restaurant` — Китайский ресторан · V1
- `building-reference-administration` — Главное управление · V1

Choose a building, wait for its preview, use «Разместить на карте», click the
ground, then «Сохранить» to persist in this browser. Placement, duplication,
transforms, removal, undo/redo and JSON import use the common map editor. Assets
load on demand; cancelled loads do not resurrect a placement ghost. Catalogue
registration does not change the default maps.

## Source and export

- Generator: `scripts/build-reference-buildings.py`, run inside the existing
  Blender instance. Regenerates only its marked scene and restores the active scene.
- Editable source: `output/building-models/v1/cyberbase-buildings-v1.blend`.
- Runtime: `public/game/buildings/reference-v1/*.glb`.
- Review renders: `scripts/render-reference-buildings.py`, four CPU threads.
- Exact budgets and dimensions: `output/building-models/v1/metrics.json`.

| Model | Triangles | Material draws | Width × depth × height, metres |
|---|---:|---:|---|
| Armory | 6,301 | 7 | 9.215 × 7.52 × 8.28 |
| Restaurant | 10,430 | 8 | 10.035 × 7.6592 × 8.28 |
| Administration | 9,174 | 7 | 13.26 × 8.04 × 13.2 |

2026-09-18 owner revision: administration shrunk to 60% on all axes, baked into
mesh positions and metric UVs. Its default editor scale remains 1; collision
bounds and thumbnails use the actual geometry. Existing saved scale overrides
remain user-owned.

In-game concrete now uses the **same shared shader and original atlas** as the
narrow balcony house / SECTOR 02, not the portable baked map. The loader replaces
only `CBR1_Concrete`, re-projects UVs in metres (2.8 m density), and retains the
original bump, roughness, formwork and edge dirt. Tint is 0xb5b5b5 × 0.75 linear.
The atlas/material are shared within a library and disposed once. Placement
ghosts preserve the custom shader when cloning translucent materials.
`src/renderer/three/cold-concrete.ts` is the unchanged legacy shader moved to the
renderer layer; `components/expedition/cyber-concrete.ts` re-exports it so existing
buildings keep their appearance. Game rendering, including thumbnails, uses this
material; the Blender review images show the portable fallback described below.

The portable Blender/GLB fallback concrete is baked from tile 0 of the same `building-atlas.webp` used by the narrow
balcony house and SECTOR 02. Linear luma, 0.105/0.56/0.14 tone weights and the cold
0xb5b5b5-based tint follow `cyber-concrete.ts`; the owner's subsequent darker
revision multiplies the concrete tint by 0.75 in linear space. Broad cloud sampling is mirrored
for a seamless portable map. Unlike the procedural shader, the GLBs do not add
shader-generated edge dirt, formwork joints or bump. Separate 1K embedded maps
for concrete and metals retain standalone glTF portability. No external texture
fetches in the standalone GLB, animations or scene lights. The in-game material
also loads the shared building atlas. Origin is at ground centre; front is glTF +Z.

`src/assets/reference-buildings.ts` owns catalogue metadata;
`src/renderer/three/reference-building-library.ts` owns asynchronous loading,
cloning and resource disposal. Public cache revision must change after rebakes.

## Validation

`tests/reference-buildings.test.mjs` parses actual GLBs, checks geometry, bounds,
UVs, embedded textures, material factors and budgets, and exercises loading,
retry and disposal races. `tests/world-editor-refresh.test.mjs` checks Base
catalogue availability, async placement, cancellation, transforms/colliders,
undo/redo and late import versus reset. Owner performs the final in-game visual
check; no browser interaction should disrupt their current placement work.
