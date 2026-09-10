# Offline vegetation workflow

Open `/editor/vegetation`. The editor uses the MIT-licensed
[VegetationGeneratorThreeJS](https://github.com/achrefelouafi/VegetationGeneratorThreeJS)
tree generator at revision `f6c26004c0763011248a65725a56ed28339fdf91`.
The source and license are in `vendor/vegetation`. The full upstream repository
was downloaded for inspection; only the tree generator and its helpers are
included in this project. Grass is a small separate CyberBase generator.

Low-poly mode is enforced. Choose seed, height, density and crookedness, then
generate. Growth finishes in the editor and instance transforms are baked into
three reusable tree models. Apply stores a validated geometry packet in this
browser, without modifying other players' maps. Reset removes that override.
Download exports the packet as `test-patch.json`; commit it under
`public/vegetation/` to publish a chosen variant for everyone.

The reproducible default bake is:

    node --experimental-transform-types --no-warnings scripts/bake-vegetation.mjs

`/expedition?debug=1&vegetation=1` opens the original editor test plot at
(22,55). The published asset is now distributed across the whole playable
Outskirts and Industrial map: 46 leafy generated trees, 70 remaining bare trees
and patchy grass. Trees stay outside the asphalt highway, POI approaches and
extraction routes. Every generated trunk has a navigation collider.

Vegetation is grouped into the same 24 m chunks as the expedition world. Only
the nearby 3 × 3 chunk area is visible. Within each chunk, every tree variant
and all grass clumps use instancing and shared geometry/materials.

The playable scene imports only the baked format and renderer: no TreePlant,
procedural growth, leaf physics, BVH or WebGPU renderer. Texture-free low-poly
materials share vertex colors and one PBR material. The source generator is
loaded only on the editor route. Future ivy painting can be added separately;
this first integration is intentionally limited to trees and grass.
