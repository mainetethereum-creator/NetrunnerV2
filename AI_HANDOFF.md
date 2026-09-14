# AI handoff — 2026-09-14 · architecture refactor stage 1

Author: Claude (Opus 5). Read `AGENTS.md` first. Branch: `refactor/engine-architecture`.

## 1. What was done

- **Direction confirmed by the owner:** Netrunner is the CyberBase game; refactor in
  place, no replacement project (ADR-001). An earlier separate `D:\V2 Cyber\CyberBase`
  monorepo was a mistake and is paused.
- Created branch `refactor/engine-architecture`; commit `e153744` snapshots the 47
  pre-existing uncommitted changes from `main` without modification.
- Full analysis of the existing code: entry points, per-concern map (scene setup,
  renderer, player, movement, camera, UI, input, mobile, map generation, objects,
  interactions, assets, collisions, expedition/base logic, state), measured import
  graph, cross-feature couplings, prioritized problems, target layers and a 12-step
  plan → `ARCHITECTURE.md`, `CODEMAP.md`, `DECISIONS.md`.
- **First refactor (no behaviour change):**
  - `src/assets/registry.ts` — asset URLs for the Draco decoder, hero model and refuge buildings.
  - `src/renderer/three/gltf-loader.ts` — `createGltfLoader()` replaces three copies of GLTFLoader + DRACOLoader setup.
  - `src/renderer/three/dispose.ts` — `disposeObjectTree()` replaces three copies of `disposeTree`.
  - `components/base/scene.ts`, `components/expedition/scene.ts`, `components/metro3d/scene.ts` use them (import and a few lines each).
  - `eslint.config.mjs` boundary rules for `src/`; `tests/engine-architecture.test.mjs`.
- Documentation for agents: `AGENTS.md` (project rules, refactor checklist, structure, commands, conventions), `ARCHITECTURE.md`, `CODEMAP.md`, `PROJECT_STATE.md`, `DECISIONS.md`, this file.

## 2. Files

Created: `src/assets/registry.ts`, `src/renderer/three/gltf-loader.ts`,
`src/renderer/three/dispose.ts`, `tests/engine-architecture.test.mjs`,
`ARCHITECTURE.md`, `CODEMAP.md`, `PROJECT_STATE.md`, `DECISIONS.md`, `AI_HANDOFF.md`.

Changed: `components/base/scene.ts`, `components/expedition/scene.ts`,
`components/metro3d/scene.ts`, `eslint.config.mjs`, `AGENTS.md` (rules appended after
the Next.js block and process hygiene, both kept).

Outside the repo: `D:\V2 Cyber\AGENTS.md` now states that Netrunner is the game and
CyberBase is paused; `D:\V2 Cyber\.claude\launch.json` has `netrunner-dev` (port 3000).

## 3. Key decisions

ADR-001 refactor in place · ADR-002 strangler migration into `src/` layers ·
ADR-003 boundaries enforced by lint + test · ADR-004 Three.js → renderer layer
gradually · ADR-005 asset registry · ADR-006 order: loop → input → camera → hero →
player state → events → renderer bootstrap → map data → editor → UI → ECS-style ·
ADR-007 no big ECS rewrite · ADR-008 maps to data only with visual parity ·
ADR-009 editors stay out of the gameplay graph · ADR-010 git workflow ·
ADR-011 explicit `.ts` imports in test-importable modules.

## 4. Commands

```bash
cd "D:\V2 Cyber\Netrunner"
npm ci
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run dev        # http://localhost:3000  (/, /expedition, /metro)
```

Stop the dev server when finished (this PC overheats from leftovers).

## 5. Manual checks

1. `/` at spawn looks like before (refuge, NPCs, buildings, lighting); no console errors.
2. WASD / arrows and Shift move the player; the camera follows.
3. Area map → choose a destination → the player walks there; "Talk to …" opens a dialog; Esc closes it.
4. Outlands breach dialog → Start expedition → `/expedition` loads; E at the breach starts extraction; movement and camera work.
5. `/metro` loads.
6. Phone (portrait and landscape): stick moves the player, touch HUD layout is intact.
7. Network: one hero GLB and one Draco decoder request per page load.

## 6. Known issues

See `PROJECT_STATE.md`. Headlines: architecture problems in `ARCHITECTURE.md` §3; dead
asset references (`slash.glb`, `cast.glb`, sword sprite); landscape touch layout and
device FPS not verified on a real phone.

## 7. Next recommended step

Step 2: `src/core/loop` — extract the rAF / visibility / context-loss / mobile cadence
loop from the three scenes with identical behaviour, then add `update / fixedUpdate / render`.

## 8. Do not rewrite without a strong reason

- The game content itself: maps, builders, materials, lighting, character, HUD, mobile layout.
- Source lines asserted by tests (`editor.stream(editor.active?pivot:player.position)`,
  `createLazyEditor(()=>import(`, NPC override lines in `base/scene.ts`, texts in `Expedition.tsx`).
- The lazy MASTER editor boundary (`world-editor/lazy-editor.ts`) and the dependency-graph tests.
- `src/` boundary rules in `eslint.config.mjs` and `tests/engine-architecture.test.mjs`.
- The refactor order and the per-step checklist in `AGENTS.md`.
