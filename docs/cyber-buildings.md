# Reference-built cyberpunk architecture

Three new catalogue assets, authored in metres with the entry facade facing local +Z. The earlier seven buildings remain available in MASTER. The new assets use the existing generated `building-atlas.webp` for concrete, plaster, steel, corrugated panels and glazing. There are no new downloaded models or image files.

| Asset | Reference | Triangles | Geometry bytes | Material draws | Bounds W × D × H, metres |
| --- | --- | ---: | ---: | ---: | --- |
| `building-neon-residence` | `home one.jpg` | 28,790 | 2,137,736 | 7 | 12.112 × 10.920 × 27.040 |
| `building-sector-02` | `home two.jpg` | 10,578 | 701,788 | 7 | 12.180 × 9.915 × 18.925 |
| `building-directorate` | `provotelstvo.jpg` | 21,772 | 1,841,736 | 7 | 13.600 × 10.800 × 42.550 |

NEON combines seven floor bands, inset glazing, selective warm/cyan/pink windows, projecting balconies, roof plant, ladders, cable risers and a billboard. SECTOR 02 has a pale cantilevered industrial volume over recessed steel service galleries, a continuous window strip, external bracing, rooftop machinery and two exhaust stacks. The Directorate uses long vertical ribs, deep window slots, alternating concrete capsules and steel throats, a guarded entrance and a restrained amber accent.

Major concrete edges have one bevel subdivision. Small trims remain simple boxes, cylindrical parts use 8–16 sides, cable curves use 16 segments, and all geometry is merged by material and indexed. Concrete stores a compact per-vertex metric surface coordinate so the atlas keeps a constant 2.8-metre scale on slabs, piers and the 42-metre tower. The shader mirrors the concrete tile, combines two scales of pore detail, neutralises ochre tint, and adds subtle formwork joints and edge grime without another texture request or draw call. Geometry/material resources are shared between placements; prototypes are built on first use. Complete side/rear facades support arbitrary editor rotation.

Signs share one 1024 × 512 canvas atlas containing deterministic typography and original flat graphics. It adds no image transfer; its estimated RGBA GPU allocation including mips is 2.67 MiB per prop-library instance. The existing building atlas remains the only downloaded building texture; metric concrete sampling adds no texture transfer. The implementation uses procedural TypeScript geometry rather than GLB files. Source size is not a compiled bundle measurement.

## Earlier catalogue buildings

All seven earlier buildings now use the same cold concrete shader in their existing material bucket 0. Concrete has a neutral base tint, consistent 2.8-metre sampling, filtered pores, broad stain variation, restrained formwork seams and edge grime. Coordinates are prepared before facade and debris rotations. Torn extruded concrete slabs use normal-directed metric projection, so the ruin's broken edges retain their shape. Plaster tile 1, brick tile 2, metal, glazing, signs and their original material buckets remain unchanged; the Tokyo shop retains its sloped metal skin, and the ruin retains its exposed brick.

| Earlier asset | Triangles (unchanged) | Geometry bytes | Material draws (unchanged) |
| --- | ---: | ---: | ---: |
| `building-workshop` | 5,544 | 396,528 | 8 |
| `building-stack` | 24,792 | 1,608,208 | 10 |
| `building-home2` | 9,756 | 558,440 | 9 |
| `building-ruin` | 25,144 | 1,586,000 | 6 |
| `building-courtyard` | 5,122 | 330,028 | 12 |
| `building-tokyo` | 8,976 | 450,816 | 10 |
| `building-tenement` | 33,744 | 2,389,600 | 8 |

Their combined geometry grows from 6,565,828 to 7,319,620 bytes (+753,792 bytes) because concrete vertices retain metric surface coordinates and UV phase across merged parts. No geometry is added. The shader samples the existing full atlas; the former tile-0 texture view is no longer allocated. The library still makes one building-atlas request. Placements share prototype geometry and materials. The combined library owns the atlas and disposes every resource once, while the cyber sublibrary only borrows it. Repeated disposal and a late image-load callback are safe; creating a placement after disposal throws.

## Expedition integration

| Placement | Replaces | Position X, Z | Conservative collider W × D × H |
| --- | --- | --- | --- |
| SECTOR 02 | old workshop | 24, 10.5 | 12.4 × 10.4 × 19 |
| NEON | old stacked residence | 81, 11.5 | 12.2 × 11 × 27.2 |
| Directorate | old tenement | 128, 11.5 | 13.8 × 11 × 42.7 |

All three use rotation 0 and face the street. Colliders include asymmetric entrance/stair projections; they also protect terrain and grass pads. The industrial galleries are facade recesses, not traversable interior space. Light anchors feed the existing nearest-light pool (two for NEON, one each for the others); no extra point lights or shadow maps are allocated.

The replaced three placements totalled 64,080 triangles / 26 material draws; the new three total 61,140 triangles / 21 material draws before culling or shadow passes. Vertex colours, bevel normals and the metric concrete surface coordinate bring their combined geometry buffers to 4,681,260 bytes. These counts do not establish device FPS.

## Verification

`node --experimental-strip-types --no-warnings scripts/audit-expedition-assets.mjs` builds the catalogue with canvas/texture stubs and measures indexed geometry. `node --experimental-strip-types --no-warnings --test tests/cyber-buildings.test.mjs` checks finite attributes, index buffers, the 35,000-triangle / seven-material budget, shared placement resources, disposal ownership and full collider coverage. Both geometry/resource tests pass.

`tests/legacy-building-concrete.test.mjs` covers all seven unchanged triangle/draw budgets, manifest geometry bytes, concrete-only metric attributes, 2.8-metre UV scale, intact extruded slabs, one atlas request, placement sharing, combined resource ownership and late-load disposal behavior. These CPU checks do not validate shader compilation or appearance.

Appearance, atlas loading, the coloured emissive shader, editor placement/rotation and gameplay are checked separately in the browser. No browser, mobile frame-time, production deployment or FPS claim is implied by the geometry audit.
