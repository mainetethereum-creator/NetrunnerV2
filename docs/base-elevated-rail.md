# Base elevated transit · 2026-09-18

## Current alignment: short rear route behind both advertising towers

The current owner layout was saved before the rail correction. Its 16 entries include
the Coinbase tower at (7.3151, -3.67, -18.7692) and the portrait media tower at
(-11, -0.92, -19). Exact backup:
`output/map-backups/base-with-wallet-tower-saved-2026-09-18.json`.

The guideway starts behind the middle of the portrait tower at x=-16, z=-28.5,
runs east behind both towers, then makes only a **35 degree** turn with a **32 m**
radius toward the metro. It uses 8 deck spans and 4 supports. The owner subsequently
requested a slight lowering: deck height is now 12.6 m (60 cm lower); train contact,
grounded supports and suspended details follow the shared height automatically.
This removes the long empty approaches and the former plaza crossing.
The V2 low-poly Blender kit, three-car train, lights, bellows, cables and city details
remain; fewer repeated modules reduce the runtime work.

Tests lock the short physical extent, constant-speed curve, tower/building clearance,
support collisions and coach articulation across the bend. The saved `Standard 2`
camera follows the hero and was restored after visual inspection.
All 185 tests, affected ESLint targets and TypeScript pass. The Base scene renders
the saved buildings and short guideway without an error overlay.

## Previous reference diagonal (rejected; superseded by the short rear route)

The earlier reference diagonal used origin z=-15.5, direction atan(.6), a 20 degree
tower-side bend, 24 deck spans and 9 piers. Its backup remains under
`output/map-backups/base-reference-rail-2026-09-18.json` for history only; do not
restore it over the current 16-entry owner map.

## Previous V2 wide curve (rejected; asset/runtime details still apply)

Owner's newer reference: `C:/Users/User/Downloads/Telegram Desktop/photo_2026-09-18_11-54-16.jpg`.
The requested sweeping route is installed, with no building or camera-save changes.
The line emerges behind the portrait tower, follows a smooth approach into a 24 m
radius quarter-circle around the administration/street, then continues east.
Deck height stays 13.2 m; 26 deck spans and 10 grounded cantilever supports.

`scripts/build-elevated-rail-v2.py` authored the upgraded Blender prototypes in the
existing session. Source: `output/elevated-rail/v2/cyberbase-elevated-rail-v2.blend`.
Runtime: `public/base/models/elevated-rail-v2.glb`, 1,016,184 bytes, registry revision
`20260918-arc2`. The user's open night-market Blender file/Scene was preserved.
Cars have stronger white headlights, cyan contour strips, warm windows, roof/service
details and amber markers. Deck and piers retain the approved metric dark concrete.

Runtime modules:
- `elevated-rail-layout.ts`: metre-based route samples, train speed/loop and rotated
  support-foot collision rectangles. `elevatedTrainX` now returns route distance.
- `curved-rail-geometry.ts`: subdivide Blender faces at 2 m intervals, interpolate
  attributes and bend the full deck along the route; joints share exact samples.
  Chord error is about 2 cm at the tightest curve; each material remains one draw.
- `elevated-rail.ts`: independent bogie-chord poses per coach, 10.5 m spacing,
  flexible bellows between coaches and a shadow-free headlight illuminating the track.
  Supports and coaches use GPU instances. Existing Base loop drives motion at 7 m/s.
- `rail-city-details.ts`: sagging cable bundles, underdeck conduit/hangers, utility
  boxes/transit tags and short warm/cyan fixtures. Lowest cables are about 8.4 m;
  ground details fit within existing column feet. Six merged material batches.

Full runtime budget before culling: **75,122 triangles / 32 draws desktop** and
**74,514 / 32 mobile**. Desktop has three shadow-free lights (headlight + two local
downlights); mobile has only the headlight, fewer cables and no railway shadow casting.
No new frame loops, timers, audio, gameplay stations or map-document entries.
Pause/dialog/MASTER stop the train; reduced motion uses the selected static composition.

167 tests, lint, TypeScript and production build pass. Tests cover route tangents/speed,
building/support clearance, deck seams/attributes, real GLB budgets/contact, independent
coach articulation and disposal. Actual coach silhouettes checked at 976 route positions:
no adjacent overlaps, minimum separating-axis clearance .816 m. Visible Base: train and
curve inspected, navigation to Oracle and dialogue work, camera follows, console clean.
Physical-phone performance was not measured. Screenshot: `output/elevated-rail/v2/in-game.png`.
Fresh owner backup: `output/map-backups/base-before-curved-transit-resume-2026-09-18.json`.

## Historical V1 (superseded by V2 above)

Owner reference: `C:/Users/User/OneDrive/Desktop/1cf37444-1497-4be6-91ff-51d95b4837ee.png`.
This new request authorizes a railway above the existing Base; it does not restore
the previously rejected night district. The main buildings and camera remain intact;
the background NEON residence was initially moved from z=-23.2863 to -28 through MASTER.
The later enlarged media-tower layout moves it farther to −37.5. The line crosses above administration and proceeds
diagonally toward the right-hand metro area.

## Blender source

- `scripts/build-elevated-rail.py` generates a dedicated scene in the existing Blender.
- `output/elevated-rail/v1/cyberbase-elevated-rail-v1.blend` is the editable source.
- `public/base/models/elevated-rail-v1.glb` contains four portable prototypes with embedded textures.
- `scripts/render-elevated-rail.py` makes `output/elevated-rail/v1/rail-review.png` with four CPU threads.

The original open Blender file/scene is preserved. Regeneration refuses to overwrite
an existing generated scene automatically. The builder reuses the reference-building
mesh helpers and existing surface/concrete maps. Front of a cab is local +X.

| Prototype | Triangles | Material draws | Dimensions, metres (length × width × height) |
|---|---:|---:|---|
| RailDeck | 708 | 6 | 8 × 4.486 × 1.93 including signals |
| RailPier | 828 | 4 | 2.85 × 7.5 × 13.8 including cantilever |
| TrainCar | 2,280 | 7 | 9.37 × 2.794 × 3.084 |
| TrainMiddle | 2,310 | 6 | 9.65 × 2.794 × 3.084 |

The 0.95 MB GLB includes a chamfered box girder, rails/sleepers, maintenance conduit,
column panel recesses, amber markers, weathered blue-black car shells, doors,
warm windows, roof vents, bogies, cab glass and thin cyan/headlight strips.
Runtime concrete uses the existing balcony-house / SECTOR 02 shader and metre UVs,
with the previously approved darker tint. Blender carries a portable baked fallback.

## Runtime

`src/renderer/environment/elevated-rail.ts` loads from the asset registry, creates
GPU instances for all repeated parts, and owns disposal. 24 spans, 9 piers and
three coupled cars cost 23 material draws and 31,314 triangles before culling.
No new lights, timers, frame loops or audio. The existing Base frame loop advances
the train at 7 m/s; looping happens beyond the ends of the visible line. Pausing,
dialogs and MASTER freeze movement; reduced motion keeps a stationary composition.
Mobile disables railway shadow casting; desktop shadow invalidation is throttled.

`elevated-rail-layout.ts` describes the diagonal: origin z=−15.5, yaw=-atan(.6),
deck top reference y=13.2. Rail-wheel contact is y=13.39; cab centres are 9.85 m apart.
The owner rejected the temporary 8.75 m rearward move and requested the original
column/track plan at a lower height. Piers repeat every 24 m starting at local x=−96,
and spans every 8 m. Columns are offset by local z=-3;
their cantilever capitals reach the track, keeping feet clear of buildings.
The first right pier returns near x=22.12,z=−5.72, beside the administration/metro.
Runtime shortens only the pier's local vertical geometry from 13.8 to 12.1 m before
projecting concrete UVs. Footprints are unchanged, capitals meet the lowered deck,
and train/deck proportions stay intact. Pillar feet have matching world
collision rectangles in Base navigation. The railway is scenery, not a boarding
station or a passenger transport mechanic; it is not part of the editable map document.

## Validation

Restoration/lowering passes all 156 tests, lint and TypeScript. Actual GLB tests
verify grounded shortened supports, deck contact and wheel/rail contact. The saved
administration's geometry within the rail corridor reaches 11.6 m, below the 12.1 m
deck underside. The enlarged media tower at the owner's latest (−11, −19) location
intersects the restored route; owner choice for tower/route clearance is pending.

`tests/elevated-rail-assets.test.mjs` parses the actual GLB and checks bounds,
rail-wheel contact, module fit, finite geometry/UVs, embedded textures and budgets.
`tests/elevated-rail.test.mjs` covers motion, diagonal footprint alignment, instancing,
reduced motion and asynchronous disposal/failure. Base navigation verifies routing
around the support and preserves all original station approaches.
