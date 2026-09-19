# Relocated metro stairwell — 2026-09-19

The owner marked the existing entrance on the east side and requested an
indentation. Its stairs, retaining shell and landing were already modeled
2.4 m below the courtyard, but solid paving and the foundation covered them.
The implementation exposes those meshes and adds four recessed guide strips
on the treads. The landing's existing local light increases from 15 to 22.
The booth, rails, walls, sealed lower door and navigation remain in place.

`src/renderer/environment/metro-opening.ts` defines the shell interior in
authored coordinates (x 5.065…11.935, z -10.73…-5.62). Four intersecting local
clipping planes discard ground fragments inside it, including shadow passes.
The foundation/annex material copies, underlying service asphalt, stone receiver and Reflector
use the cut. This is a rendering opening, not a destructive mesh boolean;
the existing stairwell supplies its sides and bottom. Scan shader hooks and
textures remain shared; scene teardown owns material copies.

`bindMetroOpening` captures the pristine recentered editor root's inverse
matrix. `base-map-editor.ts` applies its delta on original `base:metro` edits,
without per-frame traversal, geometry rebuilds or changes to saved entries.
Deletion disables the cut; restore/Undo reapplies it. The old location seals
when the entrance moves. Other catalogue copies are outside this single
authored-opening contract. `wet-floor.ts` adds Three's clipping chunks to the
Reflector shader so High quality cannot put a reflective lid over the steps.

The live owner layout had **40 entries**, including newer building/fence edits.
Before/after exports are byte-equivalent as parsed JSON:
`output/map-backups/base-before-metro-opening-2026-09-19.json` and
`output/map-backups/base-with-metro-opening-2026-09-19.json`.
The saved metro root is (25.25, -2.59, -11.5787), yaw -360°, scale 1.
Camera untouched. No import of the older 37-entry snapshot.

215 tests, lint, TypeScript and production build passed. Tests raycast the real
stair boxes while applying the same clipping predicate, verifying tread/landing
depth and retained service deck; replay recentered transform/rotation/scale,
delete/restore/reset and editor proxy changes; verify shared material hooks
and reflection planes. Live editor nudge/Undo and export retained all 40 entries.
Existing development server and Base tab stay open. No new background helpers,
commit, push, deployment or playable underground zone.
