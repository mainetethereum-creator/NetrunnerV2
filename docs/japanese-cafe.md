# Japanese food café — approved concept

Owner approved the café on 2026-09-18, then requested replacing the current Base
armory temporarily. The Coinbase wallet tower remains a concept only.

## Asset

- Concept: `output/building-concepts/2026-09-18-japan-wallet-v1/01-japanese-cafe.png`.
- Builder: `scripts/build-japanese-cafe.py` (Blender 5.2, four CPU threads).
- Editable source: `output/building-models/japanese-cafe-v1/japanese-cafe.blend`.
- Review: `output/building-models/japanese-cafe-v1/blender-review.png`.
- Runtime: `public/game/buildings/japanese-cafe-v1/japanese-cafe.glb`.
- 8,334 triangles, 10 material draws, 3,290,000 bytes (3.14 MiB).
- Bounds including signs, stools and balcony: 7.683 × 6.4 × 7.93 m (W/D/H).
- Main shell: 6.4 × 5 m; ground-centred origin, glTF +Z frontage.

Real geometry includes the shell, slat storefront, counter, bowls, four stools,
two low-sided paper lanterns, three upstairs windows, noren backing, sign frames,
balcony/AC, service doors/pipes, roof exhausts, railing and aerial. All four sides
are closed and finished. Individual UV patches preserve the approved food/menu,
Japanese signs, lantern glyphs, curtain and warm window/kitchen artwork. The PNG
is embedded unchanged once, shared by all patches. Painted interiors are exterior
details, not accessible rooms. There is no new food/shop gameplay interaction.

Concrete uses the existing `CBR1_Concrete*` material adapter and the same metre-scale
SECTOR 02 texture/tint as the earlier buildings. Standalone Blender/GLB carries
the portable fallback. Two existing 1K surface maps are reused. All 10 material
groups are opaque; there are no runtime lights, rigs, animations or extra loops.

## Integration and saved map

Registered as `ASSET_URLS.referenceBuildings.japaneseCafe`, catalogue ID
`building-japanese-cafe`, label **Японское кафе · 食堂 / ラーメン**. Base and Expedition
use the existing lazy shared library; repeated placements share GPU resources.

The owner's current Base document was exported first, including their latest
glass-corner move to (-31, .08, -1). Only the armory entry's source changed to the
café; its ID, position (-9.5747, .08, -9.8703), rotation 0 and unit scale remain.
All other 15 entries are unchanged. The armory remains available in the catalogue.
The NPC/service at the old armory is unchanged. No default or production map edit.

Owner follow-up: the placed café was enlarged uniformly to **1.3** after it looked
too small. Its current bounds are approximately 9.99 × 8.32 × 10.31 m. Position,
rotation and the other 15 entries remain unchanged. Catalogue/source asset stays
at unit scale. Fresh exports are `base-before-cafe-enlarged-2026-09-18.json` and
`base-with-cafe-enlarged-2026-09-18.json` under `output/map-backups/`. Visible scene
and exact export comparison checked; screenshot `in-game-enlarged.png` in the
model output directory. No added triangles/materials.

- Before: `output/map-backups/base-before-japanese-cafe-2026-09-18.json`.
- After: `output/map-backups/base-with-japanese-cafe-2026-09-18.json`.

These checkpoints are recovery copies, never automatic replacements for newer
owner edits. Camera framing was not changed.

## Checks

`tests/japanese-cafe.test.mjs` checks the actual GLB: exact artwork hash, embedded
textures, geometry/bounds/budgets, finite indices/attributes, closed elevations,
one lazy load, shared resources, independent transforms and single disposal.
Full suite: 181/181; lint and TypeScript pass. Blender review, live Base model and
both catalogue previews were inspected. Reload with MASTER closed restored the
café; the exported document exactly matched the saved 16 entries. Walked from the
plaza to its approach under the existing follow camera. No console warnings/errors
on either route; temporary Expedition tab closed. In-game image:
`output/building-models/japanese-cafe-v1/in-game.png`.
Physical-phone performance and final artistic review remain
owner-led. No build required for an asset/catalogue addition with unchanged
bootstrap and production boundaries.
