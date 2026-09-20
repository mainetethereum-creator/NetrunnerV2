# Canal and closed forest bridge — 2026-09-20

Owner-approved continuation of the sakura garden, using the same imagegen,
Blender and dream-loop process. A canal and planted banks finish the foreground;
an unfinished timber bridge with a closed gate hints at a future resource Forest.
The Forest is not a playable route. Existing Base navigation still ends at z 34.
Gate and construction supplies are solid. The saved city and camera are retained.

The west water, both retaining banks and their vegetation now continue to x = -68,
twenty metres beyond the earlier edge. A player standing at the western Base limit
therefore sees continuous river scenery instead of the end of the water plane.

## Owner follow-up: softer light and visible current

After reviewing the scene, the owner requested lower lantern brightness and
directional canal flow. All three water-normal scales now advect together east
along the banks at 0.65 m/s. Continuous moving wavelets replace the stationary
hash grid; projected lamp glints are shorter and their contribution is reduced
from 0.9 to 0.18. The same flow works in High and Lite and respects the existing
pause/reduced-motion controls. No additional texture, render pass or timer.

Canal paper emission is halved and point-light powers reduced by roughly 40%.
Garden lantern emission, pooled warm lights and paving glints are also softer;
the fountain and city neon retain their previous lighting. The suggested exit
to the abandoned city on the right is a separate design proposal, not a new
playable route in this change.

Follow-up validation: 9 affected park/canal tests, lint and TypeScript pass.
High/Lite visuals and sequential flow frames were inspected, plus 390×844
viewport without overflow. Evidence: `output/canal/current-flow-{a,b,mobile}.png`.
The browser timer remains throttled in the background; full-speed motion and
FPS should be assessed with the game in the foreground. No added GPU pass.

## Assets and scene

`scripts/build-canal-kit.py` builds 11 roots in an isolated scene through the
existing Blender session and restores its original active scene. New Blender
IDs are removed after export, preserving user content. Editable source:
`output/canal/canal-kit.blend`. Runtime: `public/game/canal/v1/canal-kit.glb`.
Run `scripts/pack-canal-textures.mjs` after baking, then bump the runtime query.

AI-authored surface, foliage and water-normal atlases/prompts are retained in
`output/canal/references/`; cropped source images in `output/canal/textures/`.
Washi and moss reuse the garden's generated textures. Masonry/wood/iron/paving
normals derive from luminance; these are not scanned materials. Embedded WebP
maps keep the current kit at 4,461,080 bytes; water normal is 1,081,320 bytes.

Models: retaining wall, iron railing, Japanese lantern, unfinished bridge, closed
gate with Cyrillic mesh text, timber/toolbox supplies, ivy, reeds, fern, rocks,
and moss bank/stone approach. Repeated materials/geometry use instanced meshes.
Canal scenery is scene-owned, not individually editable in MASTER.

## Runtime ownership

`canal-layout.ts` owns placement and closed-forest collision data. `canal.ts`
owns asset loading, instances, lights and mist. `canal-water.ts` borrows the
existing courtyard reflection texture and hides itself during that pass; no
additional city render. The reflection plane height is an approximation, softened
by ripple distortion. Lite retains water normals/analytic lamp/neon spill.
Mobile reduces vegetation density, light and specular-lamp counts.

Animations use the scene clock and stop under pause; reduced motion freezes
waves and mist drift. Late/partial loads and repeated teardown release owned
resources once without disposing the borrowed reflection texture.

The old service-street backdrop is clipped in world space at the north bank.
Its geometry bounds/pivot stay unchanged so the owner's rotated saved group is
preserved. Metro clipping still applies independently.

## Verification

Checks and final dream-loop/performance results are recorded in `AI_HANDOFF.md`.
`tests/canal.test.mjs` parses real bridge geometry, checks the open deck gap,
closed navigation/park route, reflection feedback guard, motion modes and
resource lifecycle. Final full suite: 225 passing tests; lint, TypeScript and
production build pass. Before/after MASTER exports contain exactly the same 40
entries. Walking through the park and rejection of a canal click were inspected.
Final foreground FPS and a physical-phone test remain owed: the host throttles
the hidden-task browser to roughly 1 FPS even when the document reports visible.
The 390×844 browser viewport at the canal has no horizontal overflow. This
does not substitute for a physical-phone/touch/render-profile check.

Independent dream-loop scores: 6.2 → 6.9 → 7.0 → 7.0. The fourth major pass
improved timber construction and foreground variation, but dense regular water
highlights offset those gains. The workflow's stalled criterion requests owner
visual feedback before further changes. Remaining gaps are water pattern,
lantern presence, supplies silhouette and retaining-wall depth. Latest live
screenshot: `output/canal/current.png`; detailed history: `output/canal/iteration-notes.md`.

Local experiment; no commit, push or deployment as part of this request.
