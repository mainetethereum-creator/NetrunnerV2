# Base MASTER — scenery authoring (2026-09-18)

Open MASTER on `/base`. Select by click or **Объекты карты**; Delete removes the
selected logical object. Ctrl+Z / Ctrl+Y undo/redo, including deleting original buildings.
G/R/S, X/Y/Z and transform fields move, rotate and scale the selection. Camera arrows
and **К выбранному** help reach distant scenery such as IMPLANTS.

**Каталог → Разместить на карте → click the ground** places a copy. Esc cancels.
The catalogue includes pristine original scenery, even when the original was removed.
Repeated clicks place additional copies. Original structures and their component materials
are preserved; buildings/planters/terminal assemblies and wall runs are selected as units.
Hero, weather, logical boundaries and service triggers are intentionally not editable.
Duplicated NPCs/terminals are visual props, not extra gameplay service registrations.

**Сохранить** persists only to this browser's `cyberbase.world-editor.base.v1` document.
In development, Base restores this document before showing the map, including when MASTER
is closed. JSON can be exported/imported separately. This is not a production map publish;
production still excludes the editor. Reset is undoable.

### Saved-map restoration fix (2026-09-18)

Previously a reload or scene recreation showed the authored map until MASTER was opened.
Closing MASTER while placed GLBs loaded could also cancel the restore, and an early Save
could overwrite storage with empty history. Base now awaits `lazyEditor.initialize()` and
the controller's initial `ready` promise before revealing the canvas or enabling play.
The factory first waits for authored model sources, then restores the saved document and
its placed models. Fresh maps without a save still load the editor only on demand.

Document requests and placement ghosts use independent cancellation generations. Selection,
Escape and closing the editor cannot cancel a restore; a newer import/reset/actual edit can.
Save/export are disabled during restoration and after failure; storage remains untouched.
Fast Refresh synchronizes the new scene with React's MASTER state and restarts the loading
screen, avoiding an open panel backed by an inactive editor.

Verification: 162 tests, lint, typecheck and production build passed. Visible Base
survived editor toggles and reload with MASTER closed; exports before/after reload
matched the owner's 15-entry checkpoint exactly. Browser error/warning logs were empty.

## Implementation

### Arrow-key performance (2026-09-18)

Transform commits now reconcile only changed entries. Unchanged authored groups no
longer receive recursive world-matrix updates or collider/NPC callbacks on every key
repeat. Document lookups use a map; the catalogue is built once. Static footprints
are cached per object and invalidated on transforms, deletion, source/length changes
or changed terrain height. Selection bounds update on selection/edits, not every frame.
The existing 90 ms publication limit still coalesces Expedition terrain/grass work.

Base collider adapters skip non-collider owners and update only the owner's matrix.
Repeated MASTER activation is idempotent. Base shadow invalidations from editor UI
are coalesced to at most 10 Hz while editing; idle MASTER no longer forces shadow
redraws. Gameplay batching, materials and map schema stay compatible.

The CPU-only fixture in `scripts/benchmark-editor-nudge.mjs` contains 120 authored
groups × 80 meshes, plus 40 placed props. Before/after reports in `output/performance/`
measure 60 edits including collider refresh: median 4.241 → 0.507 ms; p95 6.311 →
0.924 ms. Unrelated transform callbacks drop 7,140 → 0, unrelated root updates
14,280 → 0, and static selection bounds visits across 120 idle frames 9,600 → 0.
These are controller CPU measurements, not a GPU or FPS guarantee.

`tests/world-editor-performance.test.mjs` covers those avoided traversals and
move/rotation/scale/delete/undo/reset collider parity, same-ID source replacement,
and fence length geometry/collision parity. Live Base arrow input and Undo restored
the exact 15-entry owner document; before/after JSON backups are under
`output/map-backups/base-{before,after}-editor-performance-2026-09-18.json`.

Asset inventory: `scripts/audit-runtime-models.mjs` reads every public GLB/GLTF and
includes the separately generated procedural catalogue report. New buildings use
6,301–10,430 triangles; the animated hero remains 68,132 triangles and requires
separate rig/animation/visual validation before any LOD change. Reserve GLBs and
Blender authoring files are not automatically loaded by gameplay.

Round-detail optimization keeps materials/draw counts and bounds within 1.5 cm:
tire stack 10,368 → 7,776 triangles; hydrant 7,180 → 5,280; microbus 29,264 → 27,184.
`tests/round-props-budget.test.mjs` locks these budgets, finite indexed geometry,
unit normals, dimensions and material signatures. The offline catalogue audit now
counts `InstancedMesh.count` correctly while geometry bytes remain unique resources.

Final verification: all 174 tests, full lint (plus scoped lint after prop changes)
and TypeScript passed. In the visible Base editor at 1155 × 912, 12 arrow steps and
12 Undo actions preserved the exact map; the built-in rolling counter showed
158–161 FPS / 6 ms p95, CPU submission 2.4–3.2 ms, about 308 draws / 311k submitted
triangles on the sampled non-shadow frames. This short desktop sample is not a
before/after FPS comparison or a physical-phone performance guarantee. Browser
warnings/errors were empty. Existing server/tab were reused; no extra server or
Blender process was started. `process-audit-2026-09-18.json` records the many live
tool helpers separately: no confirmed orphan owner and no measured idle CPU spike
justified stopping another session.

### Open city construction pad (owner request, 2026-09-18)

`layout.ts` defines a continuous 64 × 54 m paved area: x −32…32 and z −42…12.
Foundation, reflection receiver, navigation and minimap use the same rectangle.
The obsolete opening at the metro's original position is sealed with the same
stone receiver. Since ADR-038, a live material cut exposes the existing stairwell
at the original metro object's current transform; see `metro-opening.md`. The
cut closes on delete and follows undo/rotation/scale. The former east annex gap
remains paved for further construction.
Only the front concrete fence line at z=11.35 remains; west, east and north runs
and their rubble are removed. The owner's placed building and metro transforms
are untouched.

Before refreshing the active page, the owner's current layout was exported with
the UI and saved via «Сохранить». No reset/import or storage clearing was used.
Navigation and mesh tests cover the expanded lots, sealed metro opening, platform
edges and the single retained fence line.

- `scene.ts`, `zones.ts`, `fence.ts`: stable logical labels; development-only retained sources.
- `editable-render.ts`: split instances by owner (not one mesh per leaf), preserve colors,
  shaders and shared geometry; gameplay proxies batch compatible instances on MASTER close.
- `base-map-editor.ts`: waits for model readiness, snapshots pristine catalogue templates,
  wraps active/streaming state, disables wet-floor reflection while editing/deleted floor.
- `editor-colliders.ts`/`world.ts`: replace authored collision rectangles when owners move or
  disappear. Ground/decal copies do not create walking obstacles. Map bounds are unchanged.
- Existing controller/history/schema support authored edits and copies. Copy/ghost instance
  buffers are disposed without disposing shared geometry/materials.

## Verification

135 tests, lint, TypeScript and production build pass. Tests cover geometry/world-matrix
parity, instancing/colors, hidden deleted objects, lights/disposal, collider delete/move/reset,
catalogue placement after deletion, undo/redo, save/load and non-solid floor copies.
Visible browser: removed IMPLANTS, restored with keyboard Ctrl+Z; placed and selected a crate
by click, undid it; closed MASTER and confirmed original scenery remains rendered. Test edits
were not saved. Existing server and browser reused, no extra background process started.
Physical-phone controls/performance and full Hub/Expedition interaction regression remain owed;
the shared Tactical camera parity and existing navigation tests still pass.

## Published Base checkpoint (2026-09-19)

The 40-entry owner export in `output/map-backups/base-published-2026-09-19.json`
is mirrored in `src/assets/base-published-layout.ts`. Production applies it with
`components/base/published-map.ts`, using the same authored render transforms and
collider ownership without loading the editor controller or reading browser storage.
Local development continues restoring its independent editor save. To release a
new layout, save/export the latest live document and update the release data; never
import an older checkpoint over owner edits.
