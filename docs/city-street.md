# Base city frontage and road traffic — 2026-09-19

The owner changed the abandoned-edge concept to city infrastructure and moving
cars (ADR-037). The four corner/tower placements stay in place. Twenty explicitly
identified outskirts props were removed from a fresh live export; all other
entries match exactly. Camera, walking limits and east expedition access remain.

## Layout and resources

- Scene-owned avenue extends along X, road z 16.4…26.4, beyond the pad's z=12 edge.
- Pavements, low concrete/steel divider, gutters, manholes, road markings, two
  bus shelters with route diagrams/benches and nine streetlights.
- Sedan (924 triangles), taxi (1,164) and bus (1,186) have closed 3D shells,
  glazing, doors, mirrors, wheels and emissive headlights/tail lights.
- Opposing lanes run at 7.5 / 9 m/s. The 260 m loop keeps its wrap outside the
  normal gameplay view; equal per-lane speed preserves headway (>21 m).
- 24 vehicles on desktop / 16 on touch profile, shared instanced geometry.
  Complete street costs 39 main-pass draws and 34,504 / 26,600 submitted
  triangles; shadow passes are additional. Two unshadowed point lights on
  desktop, none on mobile. Contact/headlight pools avoid moving shadow maps.
- Geometry and two small DataTextures are generated locally. No new asset
  downloads, model loader, timer or RAF. Scene-owned resources dispose once.

Implementation: `src/renderer/environment/city-street.ts`, `city-vehicles.ts`,
`city-street-geometry.ts`, pure `city-traffic-layout.ts`. The Base scene supplies
its clamped frame delta and zero while paused, in a modal or MASTER. Hidden-tab
handling remains in the shared loop. Traffic is visual scenery: no driving,
boarding, pedestrian crossings or collision gameplay. Street is not a MASTER
catalogue object; the previous outskirts models are still available there.

## Settings and saved map

Settings → **City traffic** persists separately under
`cyberbase.base.traffic.v1`. Fresh browsers follow the system reduced-motion
preference. An explicit toggle overrides it and survives reload. The owner's
browser has reduced motion enabled, so traffic was explicitly switched ON for
this request; no system settings or other animations were changed. Disabling
traffic freezes its current poses, and reenabling resumes without a jump.

Before: `output/map-backups/base-before-city-traffic-2026-09-19.json` (57 entries).
After: `output/map-backups/base-with-city-traffic-2026-09-19.json` (37 entries).
`scripts/place-city-street.mjs` derives only the 20 removal IDs from the previous
task manifest. It retains the four building additions, tall-wall deletion and
every unrelated owner record. Save/import/re-export matched exactly. Never
import the earlier checkpoints over a newer owner map.

The street is built-in Base scenery; the owner's placed skyline and wall deletion
still use the development editor save. No production map promotion or deployment.

## Verification

210 tests passed; final settings adjustment passed eight affected tests. Full
lint, TypeScript and production build passed. Traffic tests cover headway at
the wrap, lane clearance including mirrors, frame-rate independence, stop/resume,
finite geometry, mobile resource reduction, idempotent GPU teardown and exact
owner-map preservation. Both 1143×912 and 390×844 views loaded without console
errors. The temporary viewport override was reset. Saved traffic ON restored
after reload; screenshots show both directions changing position. Click-walk
along the front plaza reached the east side while the saved framing followed;
the final reload returned the hero to spawn without changing the saved camera.

The in-app browser reports ~1 FPS / 1006 ms frame cadence from timer throttling
despite document.hidden=false; these screenshots do not establish real device
performance. Physical phone testing remains owed. Review captures live under
`output/city-street-review/`. Existing Base tab/server remain open; no extra
helpers or Blender sessions were started. No commit, push or deployment.
