# Coinbase wallet tower — approved second Japan/Wallet concept

The owner authorized the next building after the Japanese café on 2026-09-18.
This implements the previously approved narrow tower concept. The original
instruction defers ticker animation; the tower and its advertising are static.

## Model

- Concept: `output/building-concepts/2026-09-18-japan-wallet-v1/02-wallet-tower.png`.
- Builder: `scripts/build-wallet-tower.py`, Blender 5.2, four CPU threads.
- Editable source: `output/building-models/wallet-tower-v1/wallet-tower.blend`.
- Review: `output/building-models/wallet-tower-v1/blender-review.png`.
- Runtime: `public/game/buildings/wallet-tower-v1/wallet-tower.glb`.
- 7,688 triangles / 10 material draws / 3,108,136 bytes (2.96 MiB).
- Bounds including projectors/roof: 8.2 × 7.64 × 32.74 m (W/D/H).
- Ground-centred origin; main logo and entrance face glTF +Z.

The six-sided chamfered shell has a concrete plinth, opaque smoked glass on all
four elevations, entrance, ventilation, service panels/pipes, drooping cables,
roof guardrail, twin fan housing and antennas. The approved source PNG is embedded
byte-for-byte; individual upper/lower glass patches preserve the logo, reflections
and amber offices. Painted offices are exterior detail, not accessible rooms.
Concrete uses the existing metric SECTOR 02 shader and 0.75 tint, with a portable
fallback in Blender. The two shared 1K metal/concrete maps come from the armory.

The ticker is a separate closed-perimeter mesh, `CBW1_TickerRibbon`, about 30 cm
outside the shell and 2.7 m high. It repeats the approved **Coinbase wallet** text
and logo around all sides. Only its material uses alpha blending (.84, front-side
only); the remaining facade is opaque. Blue borders/projectors are batched with
the other geometry. A second `TickerLoop` / TEXCOORD_1 UV channel covers the full
perimeter continuously for future animation. UV0 currently shows static concept
artwork. Future scrolling still needs a clean repeating ticker texture/shader;
no animation, timer, runtime light, worker or frame callback was added here.

## Catalogue and owner map

Registered as `ASSET_URLS.referenceBuildings.walletTower`, ID
`building-wallet-tower`, label **Башня Coinbase wallet · стекло и голограмма**.
Base and Expedition use the existing on-demand shared building library. Repeated
instances share geometry/materials/textures, with independent transforms.

The owner placed the tower on Base at (7.3151, -3.67, -18.7692), scale 1,
rotation 0. The complete 16-entry map was saved in the browser and exported exactly
to `output/map-backups/base-with-wallet-tower-saved-2026-09-18.json` before later
railway work. Earlier catalogue-only checkpoints remain historical; never restore
them over this newer owner layout.

## Verification

184/184 tests, lint and TypeScript pass. `tests/wallet-tower.test.mjs` parses the
real GLB and checks exact artwork bytes, embedded texture count, bounded finite
indexed geometry, opaque closed elevations, the single transparent ribbon,
continuous UV range, triangle/draw/file budgets, coalesced loading, independent
instance transforms, shared GPU resources and single disposal.

Blender render and Base catalogue preview inspected; Expedition catalogue loads
the same model with the correct dimensions and budgets. No console warnings/errors
on either route. Temporary Expedition tab closed; existing Base tab/server remain.
Preview screenshot:
`output/building-models/wallet-tower-v1/base-catalogue.png`. No build is needed for
an asset/catalogue addition with unchanged runtime loading and production boundaries.
Physical-phone performance and the owner's artistic review remain unverified.
