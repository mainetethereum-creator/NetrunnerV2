# VegetationGeneratorThreeJS

Source: https://github.com/achrefelouafi/VegetationGeneratorThreeJS
Revision: f6c26004c0763011248a65725a56ed28339fdf91
Copyright (c) 2026 mohamedachrefelouafi. MIT; see LICENSE.

Tree generator, leaf texture helper and wind settings are vendored for the editor.
Changes: explicit .ts imports; Quality union replaces the type-only ivy dependency.
The original app was downloaded to the local temporary directory for inspection.
No WebGPU renderer, BVH, growth or CPU wind loop runs in the playable game.
The low-poly mode needs no remote bark/leaf images. Generated geometry is baked
to a bounded asset format before placement. Grass is a CyberBase-authored module.
