# Glass commercial corner — approved second concept

The owner requested the second building on 2026-09-18 after approving both Glass +
Neon concepts. Source: `output/building-concepts/2026-09-18-glass-neon-v1/02-glass-corner.png`.

## Model

- Builder: `scripts/build-glass-corner.py`, Blender 5.2, four render threads.
- Editable source: `output/building-models/glass-corner-v1/glass-corner.blend`.
- Runtime: `public/game/buildings/glass-corner-v1/glass-corner.glb`.
- Review: `output/building-models/glass-corner-v1/blender-review.png`.
- 9,064 triangles, 10 material draws, 3,286,492 bytes (3.13 MiB).
- Bounds including hardware: 14.9 × 11.427 × 21.135 m (width/depth/height).
- Ground-centred origin; entrance/advertisement face glTF +Z; chamfer is at front-left.

The five-sided shell, cut corner, roof terrace, twin fan unit, antennas, service
equipment, entrance, three hanging cables and projector are modeled geometry.
The small energy-cell hologram consists of open amber/cyan luminous strokes and
broken rings, not a solid product mesh. No animations, rigs, runtime lights or
transparent glass layers are included. Most facade detail is texture-based.

The approved PNG is embedded byte-for-byte and mapped onto the three street-facing
planes with projective UVs, preserving the red product artwork and cyan side panel.
Office interiors/reflections are painted, not accessible modeled rooms. The other
two elevations are closed opaque smoked glass with mullions and occasional warm
windows. This is an exterior prop; it adds no shop interaction or gameplay service.
Concrete uses the same `CBR1_Concrete*` adapter and metre-scaled SECTOR 02 material
as the previous buildings. Blender carries the portable fallback surface maps.

## Integration and owner map

`ASSET_URLS.referenceBuildings.glassCorner` and `REFERENCE_BUILDINGS` register
`building-glass-corner`: **Угловой коммерческий корпус · стекло и реклама**.
Both Base and Expedition MASTER catalogues use the existing lazy shared library.
The model loads only on catalogue/saved-map demand; clones share GPU resources.
No new scene loop, loader, worker, light or default-map bootstrap was added.

One copy is saved on the owner's current Base map on the open west lot:
(-24, .08, 2), rotation 90°, unit scale. Its advert faces the plaza. The rotated
footprint stays within the existing city pad, clear of the foreground fence.
The existing 15 document entries compare exactly equal; only this copy was added.

Fresh backups:
- `output/map-backups/base-before-glass-corner-2026-09-18.json` (15 entries).
- `output/map-backups/base-with-glass-corner-2026-09-18.json` (16 entries).

Placement is browser editor data, not a new production default or a deployed map.
Preserve newer owner edits instead of importing these checkpoints automatically.
The current saved camera was preserved; visual inspection walked the hero to the
building approach using the existing follow frame.

## Verification

`tests/glass-corner.test.mjs` parses the real GLB and verifies embedded artwork hash,
indexed finite geometry, grounded centred bounds, closed elevations, geometry/file
budgets, opaque materials, shared preparation/resources and single disposal.
The original three-building test now explicitly selects `building-reference-*`;
media tower and glass corner retain their separate actual-asset contracts.

All 178 tests, lint and TypeScript passed. Visible Base and Expedition editors loaded
the preview and displayed the expected budget. Base placement, numeric move/rotation,
save/export, restoration after reload and the approach from the plaza were checked.
The reloaded map exported exactly the saved 16 entries. The console reported no
errors or warnings on either route. No build was repeated for this on-demand catalogue
asset with unchanged bootstrap. Physical-phone performance and final artistic
acceptance remain owner-led.
