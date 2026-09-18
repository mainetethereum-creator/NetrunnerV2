# CYBERBASE tower, Japanese parts shop and urban office — 2026-09-19

Owner approved modeling all three concepts from
`output/building-concepts/2026-09-18-cyberbase-parts-office-v1/` using the existing
Blender/low-poly workflow. Builder: `scripts/build-city-trio.py`, Blender 5.2.1,
four CPU threads, sequential renders. No interactive Blender session was running.

| Model / catalogue ID suffix | Triangles | Draws | GLB bytes | W × D × H, metres |
|---|---:|---:|---:|---|
| cyberbase-tower | 6,726 | 9 | 3,225,608 | 8.4785 × 8.4591 × 28 |
| japanese-parts-shop | 5,496 | 7 | 3,098,232 | 10.165 × 8.5543 × 10.7 |
| urban-office | 5,512 | 8 | 3,063,340 | 11.2785 × 10.0831 × 11 |

Each ID is prefixed `building-`. Runtime GLBs live at
`public/game/buildings/<suffix>-v1/<suffix>.glb`. Editable sources, 960×1100
Blender review renders and metrics are in `output/building-models/<suffix>-v1/`.
Ground-centred origins; glTF +Z is the facade. Closed elevations and roof are
geometry, as are window frames, service hardware, pipes, cables and signs.
Window interiors/sign faces use individually rectified patches of the original
concept PNG, embedded unchanged. They are exterior visual detail, not enterable rooms.

Concrete follows the same `CBR1_Concrete` replacement contract as prior buildings:
shared dark SECTOR 02 shader with metre-based coordinates. Portable Blender/export
fallback reuses existing 1K surface/concrete textures. All materials are opaque.
No lights, cameras, rigs, animation, timers or frame callbacks ship in the GLBs.

CYBERBASE has a separate `CBCT1_VerticalTicker` mesh with `static_ticker` metadata
and normalized UV1 (`TickerFlow`) for future downward scrolling. The exact approved
letters remain static. Animation still needs a repeatable ticker texture/shader.
The parts shop retains the purple neon and warm ground floor. The office uses the
11 m option announced before modeling: including roof hardware it sits below the
12.6 m guideway (11.5 m underside). This is not taller than the 13.2 m management
building; the original two height requirements were incompatible.

Integration is data-only through the shared asset registry/catalogue/library:
both editors load on demand, copies share GPU resources and keep their transforms.
No automatic placement or replacement was made. Owner's 16-entry Base map was
saved/exported before hot reload; the post-check export matches exactly, including
Coinbase. Saved follow camera is intact.

Validation: 194 tests, full ESLint and TypeScript pass. Actual GLB tests cover
embedded source identity, safe indexed geometry/UVs, closed surfaces, bounds,
file/triangle/draw budgets, ticker channel, lazy/coalesced loads and disposal.
Blender renders and all three Base previews inspected. Expedition catalogue loads
all three with matching metrics; its console has no warnings/errors. Temporary
Expedition tab closed; Base remains open. No production build needed
for these catalogue additions; loading and production boundaries are unchanged.
Physical-phone performance has not been measured.
