# Modular security fences

Two catalogue assets follow the supplied fence references. They appear in MASTER → Ограждения and use the existing live 3D preview and geometry statistics.

| Asset | 3 m triangles | Geometry | Draw calls | Footprint × height |
|---|---:|---:|---:|---|
| `concrete-security-fence` | 1,352 | 68.1 KiB | 3 | 3.61 × 0.92 × 3.01 m |
| `powered-mesh-fence` | 3,092 | 197.6 KiB | 4 | 3.71 × 0.903 × 2.797 m |

The cast concrete fence has chamfered precast panels, panel seams, support boots with forklift recesses and lifting loops. The perimeter fence combines a concrete lower wall, real open diamond steel lattice, bolted caps and feet, conduits, an electrical box and emissive cyan post markers on both sides. The original brick-and-spikes fence remains available.

All three fences use 3 m increments, from 3–24 m. Length is the distance between endpoint pier centres. Repeated placement stays armed; an endpoint within 0.65 m of an existing fence endpoint snaps to it, including mixed fence types and rotated corners. Their endpoint piers overlap at joins, matching the existing modular-fence placement convention. Rotation, resizing, restore and deletion retain the existing browser persistence format (`netrunner.master.props.v2`).

Geometry is indexed and merged by material. Each `(asset, quantized length)` prototype is cached; placements share its geometry and materials. The new library owns its geometries/materials and borrows the city's existing generated `city-atlas.webp`; it adds no downloaded texture, GLB, point light or animation loop. Concrete and corrosion use metric projected UVs and padded atlas sampling. Placement ghosts preserve the material shader callbacks. At 24 m, concrete uses 7,932 triangles / 379.7 KiB / 3 draws; the powered fence uses 19,836 triangles / 1,279.8 KiB / 4 draws.

MASTER fence colliders now participate in movement and route finding. A separate dynamic spatial grid is rebuilt after every saved placement change, on restoring browser placements and on disposal; static authored colliders are untouched. Narrow 0.25 m panel boxes follow rotated fences, with separate wider foot boxes, so a diagonal fence does not block its entire rectangular bounding area. Collision and navigation caches update immediately when a fence rotates, shrinks or is removed. As with all existing MASTER props, browser placements load when MASTER is first opened in a scene.

The geometry/resource and snapping/navigation regression tests are in `tests/security-fences.test.mjs`. Manifest measurements for 3, 12 and 24 m are in `public/game/props/salvage/city-manifest.json`; catalogue baseline counts are in `docs/expedition-asset-counts.json`. Browser visual review should check both faces, 3 m and 24 m previews, a rotated mixed fence junction, and collision after resizing/removal.
