# AI handoff — 2026-09-18

Repository: `mainetethereum-creator/NetrunnerV2`; working branch last verified as
`feature/ui-kit-3d`. Preserve the shared dirty tree. Architecture step 5 is not
signed off. No push/deploy authorized.

## Latest task: restore the original railway, lower it; tower clearance pending owner choice

Owner prefers the original rail/column plan and requests slightly lower height for
the saved gameplay camera. Restored origin z=−15.5 and pier pattern −96 + 24n.
Lowered deck from 14.9 to 13.2 m, train follows at 13.3773 m. Runtime scales only
column geometry vertically to meet the deck underside at 12.1 m, retaining grounded
feet and metric concrete UVs; deck/train dimensions and animation remain unchanged.
Actual administration triangles under this rail strip reach y=11.6000, leaving .5 m.
156 tests, lint and TypeScript passed; visible saved-camera view checked.

Before editing, fresh browser export revealed owner edits since the previous turn:
15 entries, media tower at (−11, .08, −19), uniform .8; the rear NEON entry was removed.
Preserved these exact values and all other entries. Authoritative checkpoint:
`output/map-backups/base-before-rail-return-2026-09-18.json`. Do not re-import the older
16-entry map or move the tower to the prior coordinates automatically.

The original railway intersects the tall media tower at the owner's current location.
An async question is pending: move tower behind the tracks keeping dimensions, or
keep tower and route tracks beside it. No dependent tower/route change is authorized
by a selected answer yet; do not infer an answer from elapsed time. Base preview is
open on original saved camera with restored/lowered rail. No new processes started.

## Previous task: enlarge the tower and move the railway behind it (rail move superseded)

Owner rejected the small replacement and requested nearly ARMORY width, greater
height and moving the railway if necessary. Latest saved tower: (−7.75, .08, −18.25),
uniform scale .8, dimensions 8.96 × 7.98 × 27.768 m (ARMORY width 9.22 m).
The portrait keeps its proportions. IMPLANTS remains deleted. Background NEON
`prop:9b3188e6-e972-4885-ba4d-a748b3b839a6` moves from z=−28 to −37.5 to clear the line.
All 14 other map entries are unchanged; no tower duplicate was added.

Runtime railway origin z changes from −15.5 to −24.25 (8.75 m back), including
train/deck/piers/collisions. The 24 m support pattern starts at −102 rather than −96,
moving the right support behind administration and west of the moved metro entrance.
Tower/track and rear NEON/track footprint gaps exceed 1 m; ARMORY gap is .63 m.

Saved checkpoint: `output/map-backups/base-tower-full-size-2026-09-18.json` (16 entries,
6 deletions). Fresh pre-edit backup: `base-before-tower-enlargement-2026-09-18.json`
in the same directory. Screenshot: `output/building-models/media-tower-v1/in-game-full-size.png`.
Inspected whole building with temporary free zoom; owner's saved camera was restored.
156 tests, lint and TypeScript pass, including support movement and no old ghost collider.
No model regeneration, asset-budget increase or new process. Placement still loads
through MASTER; the rail position is source scenery. Second concept remains pending.

## Previous task: media tower replaces the marked IMPLANTS house (small scale superseded)

Owner marked the house behind ARMORY and requested the new advertising tower there.
Updated the live MASTER document only: `base:implants` is deleted, the existing
`base:media-tower` moves to (−7.75, .08, −15.8), uniform scale .375. Its 13.016 m
height matches the former 13 m house; the footprint clears ARMORY and the top stays
below the railway deck. No duplicate tower remains on the east lot in this layout.
Original portrait/materials and saved follow camera are unchanged.

Saved through the UI and exported:
`output/map-backups/base-tower-replaces-implants-2026-09-18.json` (16 entries,
6 deletions). Compared against fresh live pre-edit export: exactly those two entries
changed, all 14 others preserved. Backup before replacement:
`output/map-backups/base-before-tower-replacement-2026-09-18.json`.
Screenshot: `output/building-models/media-tower-v1/in-game-replacement.png`.
Visible game view and save status verified; browser errors empty. This is a map
authoring change, not a runtime code/default-scene change; open MASTER after reload
to apply the saved browser layout, as before. No source tests/build were repeated.

## Previous task: first approved glass media tower installed

Owner approved both concepts but requested **only the first tower now**, preserving
the woman's exact image/style. Built in existing Blender as a separate scene/source;
the user's open `.dream-loop/night-market-kit.blend` and active scene were preserved.
`output/building-models/media-tower-v1/media-tower.blend`; runtime GLB under
`public/game/buildings/media-tower-v1/`; 6,623 triangles, 9 draws, 3,071,264 bytes,
11.2 × 9.975 × 34.71 m. The approved concept PNG is embedded byte-identically via
projective facade UVs; this is a static advertising skin, not a new generated face.

Default Base placement (24, .08, −27), stable owner `base:media-tower`, collider 17;
catalogue ID `building-media-tower`, name «Медиа-башня · стекло и портрет», available
in Base and Expedition. Shared reference-library cache revision is `20260918-8`.
Source, lifecycle, placement and validation: `docs/media-tower.md` (ADR-033).
Second concept remains unmodeled. Existing map entries and saved camera were preserved;
pre-change export: `output/map-backups/base-before-media-tower-2026-09-18.json`.

156 tests, lint, TypeScript and build passed; final asset passed 11 targeted tests.
Browser confirmed final catalogue count/placement/portrait and no errors. Game review:
`output/building-models/media-tower-v1/in-game.png`. Physical-phone performance not
measured. Existing Base tab/server and Blender session retained; no new servers/helpers.

## Previous task: working-instruction audit

Applied the owner's requested review against
[OpenAI's skills and prompts article](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra).
`AGENTS.md` now routes documentation by task, defines completion and proportionate
checks, and distinguishes temporary-process cleanup from a requested running server.
`ROADMAP.md` is only a refactor/debt continuation protocol. Retired instructions
to stash the shared dirty workspace for timing comparisons. No repository-owned
SKILL.md files were found; installed plugin files and global settings were not changed.
Validation for this docs-only task: instruction consistency, local references,
generated Next.js block preservation and diff checks; no game build needed.

## Current Base and assets

- Open city pad (ADR-032): paving, foundation and reflections cover
  x −32…32, z −42…12 (64 × 54 m), with matching navigation/minimap bounds.
  The original metro hole and east-side void are sealed. Only the front concrete
  fence at z=11.35 remains. See `docs/base-map-editor.md`.
- Railway (ADR-031): Blender deck/pier/cab/middle-car kit, diagonal over the
  administration/metro side, animated three-car train. 31,314 triangles / 23 draws;
  column-foot collisions. Source `output/elevated-rail/v1/cyberbase-elevated-rail-v1.blend`,
  runtime GLB revision `20260918-4`. See `docs/base-elevated-rail.md`.
- Camera (ADR-030): saved angle, distance and pan FOLLOW the hero in Base and
  Expedition. Manual framing uses `frame-camera.ts`; Base hero visuals are ×1.25.
  See `docs/base-camera.md`. Do not restore the retired world-fixed camera behavior.
- Armory, Chinese restaurant and administration are in both MASTER catalogues.
  Concrete uses the approved narrow-balcony/SECTOR 02 shader, metric UVs and darker
  tint; administration is 60% size. See `docs/reference-buildings.md`.
- Green IMPLANTS remains in source scenery/catalogue but is removed in the latest
  saved owner layout, where the media tower replaces it. Earlier district/railway removal and the
  north-fence layout are historical, superseded where stated by ADR-030/031/032.

## Saved owner layout

The live browser's latest layout is authoritative. MASTER loads browser-local
`cyberbase.world-editor.base.v1` on first opening; closing it returns to gameplay.
After a reload the original layout can appear until MASTER is opened.
Preserve unsaved edits before reloading; never reset or import an older backup automatically.

Latest verified checkpoint: `output/map-backups/base-before-rail-return-2026-09-18.json`
(15 entries, 6 deletions); restore instructions: `output/map-backups/README.md`.
The owner moved the .8-scale tower to (−11, .08, −19) and removed the rear NEON entry
after the previous turn. These latest edits were preserved during railway restoration.
Earlier checkpoints and both pre-change exports remain available.
It includes armory (−9.5747, −9.8703), administration (12.3706, −10.0715),
metro (24.5, −11.5787), courtyard house (0.5838, −10.4924),
remaining NEON (−20.5199, −11.9723)
and directorate (10.4113, −34.018). These are x/z coordinates.
The restaurant is available in the catalogue but absent from this checkpoint.
The camera is saved separately as `cyberbase.base.camera-frame.v1`; it is not in map JSON.
The railway and platform bounds are source-code scenery, not editor JSON.

## Verification and environment

The preceding city-pad change passed 151 tests, lint, typecheck and production build.
The visible Base showed the saved buildings, sealed hole, side paving and front fence;
browser error logs were empty. Physical-phone controls/performance and the broader
refactor checks in ROADMAP TD-02 remain owed; do not infer those from the desktop screenshot.

The user explicitly requested the dev server for continued work. The last server
session was 62404 on port 3000 and the existing browser tab was at `/base`.
Verify current availability before starting another; retain the user's preview and
Blender session. No new background process was started by the instruction audit.

Historical session notes: `docs/archive/ai-handoff-before-instruction-audit-2026-09-18.md`.
They are a record of earlier work, not current task instructions.
