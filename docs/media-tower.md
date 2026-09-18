# Approved media tower — 2026-09-18

The owner approved both glass/neon concepts and requested implementation of the
**first tower only**, preserving the woman and visual style. The later owner request
also authorized the second building; its model and integration are in `glass-corner.md`.

## Asset and likeness

- Approved source: `output/building-concepts/2026-09-18-glass-neon-v1/01-media-tower.png`.
- Blender builder/review: `scripts/build-media-tower.py`, `scripts/render-media-tower.py`.
- Editable source: `output/building-models/media-tower-v1/media-tower.blend`.
- Runtime: `public/game/buildings/media-tower-v1/media-tower.glb`.
- 6,623 triangles, 9 material draws, 3,071,264 bytes; 11.2 × 9.975 × 34.71 m.
- Origin is ground-centred, main advertising facade faces glTF +Z.

The GLB embeds the **byte-identical approved PNG**. Projective UVs straighten the
front, chamfer and advertising side onto real building faces. The woman is neither
regenerated nor recompressed. The right elevation repeats the advertising-side
treatment so it remains coherent from the saved gameplay camera. This is a static
media skin: some window reflections/details remain painted in the source image,
not real office interiors or a live video. Roof, plinth, door, equipment, guardrails
and cables have actual low-poly geometry. Glass is opaque reflective material,
avoiding layered transparent windows and modeled interiors.

Concrete is replaced by the existing dark SECTOR 02 shader through the shared
reference-building library. Portable Blender concrete and metals reuse the original
compressed surface maps from the approved armory GLB. Advert emission is restrained;
scene lighting/tonemapping necessarily differs from the concept illustration.

## Base and editor integration

Latest owner edits supersede the placement below: tower at (−11, .08, −19), still
uniform .8; rear NEON removed. Fresh checkpoint has 15 entries:
`output/map-backups/base-before-rail-return-2026-09-18.json`. The owner then requested
restoring the original rail/column plan with a lower deck. That line intersects this
tower position; clarification on moving the tower or routing beside it is pending.
Preserve the owner's latest tower position until the answer arrives.

Latest owner layout: the tower replaces the marked IMPLANTS house behind ARMORY.
The owner rejected the initial .375 scale as too small. The saved editor document
now places `base:media-tower` at (−7.75, .08, −18.25), uniform scale .8: 8.96 m wide,
7.98 m deep and 27.768 m tall. ARMORY is 9.22 m wide. The original portrait keeps its
proportions. IMPLANTS remains deleted. Railway origin moves back 8.75 m to z=−24.25;
its supports shift along the track to clear the metro. Rear NEON moves to z=−37.5
to clear the new rail corridor; all 14 other entries are unchanged. The tower clears
ARMORY by .63 m and the railway by over 1 m. Saved checkpoint:
`output/map-backups/base-tower-full-size-2026-09-18.json`. Visible verification:
`output/building-models/media-tower-v1/in-game-full-size.png`. This placement is
browser/editor authoring data; default source scenery remains as described below.

`src/assets/media-tower.ts` defines the default placement at (24, .08, −27), on
the east rear lot behind the metro and beside the directorate. It clears the railway
and the platform edges. `src/renderer/environment/media-tower.ts` adds one default
Base object using the same loader/material adapter as the catalogue. It owns its
library, handles late completion/disposal and participates in the scene's asset-ready
barrier before MASTER snapshots authored scenery.

Both Base and Expedition MASTER catalogues include **Медиа-башня · стекло и портрет**
(`building-media-tower`). Base's default instance is `base:media-tower`; it can be
selected/moved/deleted as one object. Its authored collider is index 17 and follows
editor transformations/deletion. The original default appears without activating
the editor, including production; editor UI remains development-only.

The owner's prior 15 map entries were preserved unchanged. Backup before integration:
`output/map-backups/base-before-media-tower-2026-09-18.json`. The final 16-entry layout
was saved in the browser and exported to
`output/map-backups/base-with-media-tower-2026-09-18.json`; the extra entry records the
default tower's transform. Do not import an old backup over newer owner edits.
Camera inspection used temporary free orbit; the
owner's saved follow frame was not overwritten.

## Verification

After enlargement/rail relocation: all 156 tests, lint and TypeScript passed.
Checked the saved layout preserves 14 unrelated entries, uniform portrait scaling,
building/rail clearance, platform bounds and support clearance from metro/administration.
The tower was inspected with temporary free zoom; the saved follow frame was restored.

156 tests passed, plus lint, TypeScript and production build. After the final side
facade/texture optimization, all 11 media/reference-building tests passed again.
`tests/media-tower.test.mjs` checks the portrait's embedded SHA-256, parses the actual
GLB, checks dimensions/budgets/facade ray hits, traversable approach and railway
clearance, editable collisions, single resource disposal and late/error completions.
Visible Base verification confirmed the final 6,623-triangle model in the catalogue,
default placement, preserved owner layout, glass portrait/red side ad and no browser
error logs. `output/building-models/media-tower-v1/in-game.png` records the game view;
`blender-review.png` records the studio view. Physical-phone performance remains untested.
