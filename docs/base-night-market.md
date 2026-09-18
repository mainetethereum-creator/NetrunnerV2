# Base environment — owner rollback, 2026-09-18

## Current decision (ADR-027)

The owner rejected the district surroundings in browser annotations. Restore the original Base
and keep only the green IMPLANTS building marked in the second screenshot.

- Original courtyard, west wall, navigation bounds, nine stations, minimap and rain restored.
- No added city backdrop, middle-distance apartments, rail/viaduct/train, road extension,
  armory, food stalls, lanterns or optional city audio. Their settings/terminal actions are gone.
- IMPLANTS remains at x=-20.5, y=.08, z=-8 with its original textures, geometry and two cyan
  signs. It is scenery outside the old west wall, not a new walkable district or station.
- Tactical is the only camera (ADR-026). Physical WASD (including ЦФЫВ), arrows, Shift, tap paths
  and the mobile stick remain. Text/modal/editor input stays gated; close MASTER to walk.

## Asset and ownership

Runtime: `src/renderer/environment/implants-building.ts` loads
`public/base/models/implants-building.glb` from the asset registry and owns cleanup.
6,972 triangles, six meshes/materials, 1,029,752 bytes; two small sign textures and one
unshadowed point light. No new animation, frame loop or postprocessing.

`scripts/extract-implants.mjs` extracts the retained subtree and referenced binary data from
the original Blender-authored `night-market-kit.glb` without re-authoring geometry/materials.
Original kit, backdrop and builder remain on disk for recovery but are not referenced by runtime.
Removed TypeScript/audio/layout modules and audio tests have local text backups under ignored
`.dream-loop/removed-district/`. Do not restore them without a fresh owner request.

## Verification

Run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
121 tests currently pass, including old camera parity, all original station approaches,
rejection of former west-district destinations, and standalone Implants asset budgets.
Physical-phone input/performance still needs owner/device testing.
