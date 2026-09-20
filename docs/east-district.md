# East garden / expedition boundary — 2026-09-20

The owner approved the east-district reference, with one correction: there must
be earth and greenery under the outer railway, not a lower city or an empty drop.
The fence is the walking boundary. The damaged opening leads to the existing
expedition dialogue and `/expedition`; it never permits free walking outside.

## Scene and assets

- `east-district-layout.ts`: plaza x 30.8–46.5, z −10–34; two service buildings,
  three planted beds and the exit at (44.8, 25). World collision and minimap use
  the same layout. The old saved map and camera are not rewritten.
- `east-district.ts`: one Blender kit, tiled extension borrowing the courtyard's
  material, two burning barrels and tire piles, small warm light pools. The old
  iron fence instances are replaced at runtime by the same precast-panel language
  as the retained front wall: three concrete courses, tapered feet, recessed
  joints and steel lifting eyes. The original eight-metre damaged breach remains.
  Collision still closes the entire interaction line, including the visible gap.
- Beyond the breach, a rain-dark gravel path bends into the grounded railway
  shoulder. Thirty-four instanced edge stones and 78 deterministic plant
  placements (ferns, broadleaf shrubs and reed grass; half density on mobile)
  keep its centre readable while making both banks denser. This adds nine draws,
  no asset download, no light and no animation loop.
- Flame animation uses the existing scene clock and respects pause/reduced
  motion. The kit owns its resources; the courtyard owns paving.
- `sakura-park.ts`: three additional sakuras, lanterns/benches and ground planting
  reuse the already-loaded park kit and material batches. Mobile lowers planting
  density. Delivery robots keep their existing route.
- `wet-floor.ts`: the existing single planar reflector now includes the east
  tile plaza. No second scene render/reflection target was added.
- `elevated-rail-layout.ts`: original alignment remains exact through 60 m.
  The newer owner correction sends the working railway east, with a broken
  old southern leg and all four original outer columns retained. Ground extends
  beneath both alignments. See `docs/base-elevated-rail.md` for current counts.
  Existing train models, instancing, geometry bending and speed are reused.

Generated material atlas: `output/east-district/references/surfaces.png`.
Updated grounded target: `output/east-district/references/target.png`.
Exact prompts are beside it in `prompts.json`. No third-party asset downloads.

Blender source: `output/east-district/east-district.blend`.
Rebuild in the existing Blender session using `scripts/build-east-district.py`,
then run `node scripts/pack-east-district-textures.mjs`. Authoring happens in a
temporary scene; the user's existing scene, selection and filepath are retained.
Nine roots, 23,424 source triangles, 30 material batches, 3,227,504-byte GLB with
embedded WebP base-color/normal maps. Registered as `ASSET_URLS.eastDistrict`.

## Verification

Pre-change owner map saved/exported through MASTER:
`output/map-backups/base-before-east-district-2026-09-20.json`.
The east-boundary update adds targeted checks for the precast section counts,
old-fence removal, trail endpoints, three plant variants and GPU teardown. All
232 tests, ESLint and TypeScript pass; the production build remains from the
original district checkpoint. Tests cover garden
navigation to the exit, collision with the fence even through its visual breach,
solid planting/buildings, ground beneath every new support, a physically open
breach model, and teardown without disposing the borrowed courtyard material.
The former east-void test now checks the new outer edge; park collision remains
solid where the expanded district overlaps the old park boundary.

Live visual review and final map parity are in progress. No push or deployment.
