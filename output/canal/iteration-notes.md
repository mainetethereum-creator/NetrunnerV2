# Canal dream-loop, 2026-09-20

Approved reference: `references/target.png`. Existing city/park and the owner's
saved camera are preserved. Live comparison screenshots: `.dream-loop/canal/`.

Round 1 independent review: **6.2/10** — composition 2.3, lighting 1.9,
materials 1.4, details 0.6. Main gaps: paved rather than planted near bank,
thin reddish bridge lattice, regularly oval lamp reflections, shallow fine
masonry, small/missing construction and natural details.

Round 2: regenerated Blender kit with heavier timber/handrails and larger open
deck bays, enlarged stone relief, textured moss bank and a stone bridge approach.
Three irregular fern layers, larger rocks and reeds replace the paved foreground.
Lower water reveals more wall; anisotropic normals, broken cyan/magenta spill
and stronger low mist vary the water. GLB remains below 4 MB.

Round 2 independent review: **6.9/10** — composition 2.5, lighting 1.9,
materials 1.8, details 0.7. Planting/layout improved, but repeated gaps in
water highlights, timber material, wall scale and natural rock silhouettes
triggered the workflow's major-change stage.

Round 3: rebuilt reflection energy as projected broken wavelet streaks, distorted
and fragmented borrowed reflections, strengthened coloured neon spill. Generated
new single-beam timber, ashlar and mossy rock textures. Rebuilt boulders with
irregular rounded geometry, larger retaining blocks, fewer heavier timber posts,
bolted joints and deeper joists. Varied foliage tint by cluster; reduced global
point-light count and added local foreground pools. Enlarged/repositioned the
timber stack/toolbox, including its matching collision footprint.

Round 3 review: **7.0/10** — composition 2.4, lighting 2.0, materials 1.9,
details 0.7. Reflection artifacts reduced and warm timber/boulders improved,
but another structural pass was needed: manufactured-looking bridge frame,
over-fine water glints, uniform planting and obscured supplies remained.

Round 4 reconstructs the bridge around three deep load-bearing beams, larger
uneven open bays, partly laid boards, side diagonals and rectangular timber
handrails. Wood UV grain follows the long axis; a rougher warm material reduces
the blue grazing reflection. Supplies move onto a small masonry work landing
outside the tree canopy. Amber lantern bodies are larger, water has three ripple
scales and wider fragmented streaks, fern heights vary and clearings expose low
boulders. Model geometry shrank to a 4,461,080-byte packed kit.

Round 4 independent review: **7.0/10**, unchanged — composition 2.4, lighting
1.8, materials 2.1, details 0.7. Timber/deck construction and foliage variation
improved. Water regressed into dense even orange/cyan stippling; its lack of
dark patches and irregular broad waves offsets the material improvements.
Remaining gaps: uniformly reddish wood, small weak lanterns, supplies reading
as a flat extension, repeated shallow masonry. The major-change pass did not
raise the total score, so the Pro workflow's stalled criterion is reached.
Stop visual iterations and request owner feedback; do not claim >=8 or parity.

Final validation: 225 tests, lint, TypeScript and production build pass. Browser
park movement and rejection of a canal click checked. 390×844 canal viewport
has no horizontal overflow. All 40 MASTER entries exactly match before/after.
Initial High check: 60 FPS / 18 ms p95. Final kit FPS remains unverified because
the host now throttles the hidden-task tab to ~1 FPS despite visible document
state. No physical-phone performance claim. Original Blender Scene restored
(3 objects); no new server/process remains. Existing dev server 3000 retained.

## Owner-directed follow-up

Owner reviewed the result and requested softer lantern lighting and visible
current. This supersedes the previous target's bright amber reflections for
the focused correction. The three normal scales and continuous glint masks
now move east at 0.65 m/s; a stationary hash grid is removed. Lamp contribution
0.9 → 0.18 with shorter falloff, halved canal paper emission and softer canal/
garden point lights and path highlights. No new models, textures or render pass.
Affected 9 tests, lint and TypeScript pass. Live High/Lite visuals inspected;
background timer throttling persists, so no updated FPS assertion. The earlier
7.0 score belongs to the old reference and is not a new rating of this correction.
