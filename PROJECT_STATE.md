# Project state — Netrunner / CyberBase

Last updated: 2026-09-14 · branch `refactor/engine-architecture` · architecture refactor stage 1.

## Implemented (the working game — must be preserved)

- **Base `/` — Runner's Refuge:** procedural refuge (courtyard, zones, metro pit, perimeter fence, service street) + GLB buildings (workshop, oracle ×3 placements, city gate); PBR concrete/metal/stone, rain, wet-floor reflections (High), adaptive quality; NPC stations with dialogues (Cybersmith, Cryptomancer, Oracle, Green Exchange, Keeper, City airlock, locker, Quantum Charge, Outlands breach); orientation quest (localStorage); Base wallet connect; settings (rain, quality, perf stats, reset camera); minimap destinations with pathfinding; MASTER map editor for NPCs/props.
- **Expedition `/expedition` — Outlands:** 144 × 72 m world in 24 m chunks; terrain, asphalt highway, hangars, cyber buildings, props, fences, microbus, fires, baked vegetation, grass; POIs, loot tables, events, extraction (4 s), death loss, local stash; enemies implemented but disabled (`EXPEDITION_ENEMIES_ENABLED=false`); MASTER props / trees / landscape editors; debug panel (`?debug=1`).
- **Metro `/metro`:** frozen environment prototype.
- **Character & combat:** Neon Sentinel GLB (Draco), in-place run, procedural idle pose, class combat (Warrior / Mage / Ranger, skills 1–4, energy, cooldowns), retargeted ranger shot, great sword; HUD vitals/skills/menu; character, inventory and talents panel.
- **Controls:** WASD / arrows, Shift run, E interact, Space fire (expedition), 1–4 skills, I inventory, H hide HUD; tap / click to move; mobile stick with dead zone; touch profile with adaptive DPR and 30 fps fallback.
- **Tools:** vegetation editor `/editor/vegetation`, UI kit preview `/ui-kit-preview`.

## Architecture refactor progress

| Step | Status |
|---|---|
| 0 · Baseline (branch, snapshot commit, checks, screenshots) | done |
| 1 · Asset registry + shared glTF loader/disposal + boundary rules + docs | done (this stage) |
| 2 · `src/core/loop` wrapper, then update / fixedUpdate / render | next |
| 3–12 · input, camera, hero animation, player state, events, renderer bootstrap, map data, dev map editor, UI modules, ECS-style systems | planned (`ARCHITECTURE.md` §5) |

## Verification of stage 1

- Before any change: `npm test` 79/79, `npm run lint` clean, `npx tsc --noEmit` clean; screenshots of `/` and `/expedition` at spawn.
- After the change: `npm test` 82/82 (3 new architecture tests), lint clean, tsc clean, `npm run build` succeeds (Next.js 16.3.4, all routes: `/`, `/expedition`, `/metro`, `/editor/vegetation`, `/ui-kit-preview`).
- Browser (dev server, desktop 618×910 pane): `/`, `/expedition` and `/metro` load with no console errors; `/` and `/expedition` look identical to the before-screenshots; W / D keys move the player; minimap destination walks to the Cybersmith, camera follows, "Talk to cybersmith" opens the dialog, Esc closes it; Expedition E at the breach starts extraction; one hero GLB and one Draco decoder request per page.
- Mobile emulation 375×812 (touch): touch layout, stick visible, stick drag moves the player, no errors.

## Partially implemented

- New layers exist only for assets (`src/assets/registry.ts`) and renderer utilities (`src/renderer/three`). Everything else still lives in `components/`.
- Asset registry covers the Draco decoder, hero model and refuge buildings; other asset paths are still hardcoded.
- Expedition enemies are disabled; combat damage resolves at activation; level stays 1; talents are locked.
- Editors save only to browser localStorage.
- Metro is a frozen prototype.

## Planned

See `ARCHITECTURE.md` §5 (steps 2–12) and `docs/` feature notes.

## Known issues

- Architecture problems listed in `ARCHITECTURE.md` §3 (monolithic scenes, duplicated engine code, Object3D as source of truth, no fixed timestep, window event bus, map layout in code, module-level state).
- Dead asset references: `slash.glb`, `cast.glb` in `components/game/class-actions.ts` and `/game/weapons/sword/01-up.webp` in `components/game/sword-attack.ts` point to files that do not exist (not requested at runtime today). `public/base/models/outlaw-refuge.glb` is unused.
- Landscape phone layout could not be tested with touch in browser emulation (custom sizes ≥ 768 px wide get no touch emulation); real-device portrait/landscape and FPS still need a phone test.
- The browser network log accumulates across reloads; count requests per document (Resource Timing) when checking duplicate loads.
- `D:\V2 Cyber\CyberBase` is a paused, separate project created by mistake; do not build on it.

## Next recommended task

Step 2: extract the `requestAnimationFrame` / visibility / context-loss / mobile cadence loop from the three scene factories into `src/core/loop` with identical behaviour, verified with the same checklist; then introduce `update / fixedUpdate / render` phases.
