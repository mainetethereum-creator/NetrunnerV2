# AI handoff — 2026-09-14 · architecture refactor step 2

Author: Claude (Opus 5). Read `AGENTS.md` first. Branch: `refactor/engine-architecture`.

## 1. What was done in this step

- **Shared frame loop** `src/core/loop/frame-loop.ts` (`createFrameLoop`):
  requestAnimationFrame scheduling, hidden-tab modes (`stop`: no frames while hidden,
  resync and restart on visibility change; `skip`: keep scheduling and skip hidden
  frames), mobile cadence cap via `targetFps`, 0.05 s delta clamp, phases
  `fixedUpdate × N → update → render` with interpolation `alpha`, injectable platform.
- **Scenes use it** without behaviour change:
  - `components/base/scene.ts`: `updateFrame` / `renderFrame`, `stop` mode, cadence cap on touch devices, `loop.stop()` on WebGL context loss, `loop.dispose()`.
  - `components/expedition/scene.ts`: same; modal still freezes simulation time; context loss still only reports an error.
  - `components/metro3d/scene.ts`: `skip` mode (its previous behaviour).
- Tests: `tests/frame-loop.test.mjs` (timing equals the legacy loops on identical
  timestamps, hidden modes, stop/dispose, fixed steps, exceptions);
  `tests/engine-architecture.test.mjs` now also asserts scenes use the shared loop.
- Docs: `ARCHITECTURE.md` (§1.2, §2, §3, §4, §5), `CODEMAP.md`, `DECISIONS.md` (ADR-012), `PROJECT_STATE.md`, this file.

Previous step (1): asset registry, shared glTF loader and disposal, `src/` boundary
rules, full architecture documentation (see git history and `DECISIONS.md` ADR-001…011).

## 2. Files

Created: `src/core/loop/frame-loop.ts`, `tests/frame-loop.test.mjs`.
Changed: `components/base/scene.ts`, `components/expedition/scene.ts`,
`components/metro3d/scene.ts`, `tests/engine-architecture.test.mjs`,
`ARCHITECTURE.md`, `CODEMAP.md`, `DECISIONS.md`, `PROJECT_STATE.md`, `AI_HANDOFF.md`.

## 3. Key decisions

- ADR-012: one frame loop; phases `fixedUpdate → update → render`; scenes split at the
  render call so the original statement order is unchanged.
- `fixedUpdate` is deliberately **not** used by scenes yet: player state lives on
  Object3D and is not interpolated, so fixed steps would stutter on high-refresh
  displays. Movement moves to fixed steps in step 6.

## 4. Commands

```bash
cd "D:\V2 Cyber\Netrunner"
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run dev        # http://localhost:3000  (/, /expedition, /metro)
```

Stop the dev server when finished.

## 5. Manual checks

1. `/` and `/expedition` look like before; no console errors; `/metro` loads.
2. WASD / Shift movement speed feels unchanged; the camera follows.
3. Area map → Cybersmith → "Talk to cybersmith" → dialog → Esc.
4. `/expedition`: E at the breach starts extraction; open a panel (I) and confirm the world freezes while it is open.
5. Switch to another browser tab for a few seconds and back: the game resumes once, without a speed-up or a jump.
6. Phone: stick moves the player in portrait and landscape; frame cadence falls back gracefully under load.
7. Lose the WebGL context (e.g. GPU reset) on `/`: the error notice appears and rendering stops.

## 6. Known issues

See `PROJECT_STATE.md`. Headlines: remaining architecture problems in `ARCHITECTURE.md` §3;
dead asset references; landscape touch layout, real tab hiding and device FPS not verified on a phone.

## 7. Next recommended step

Step 3: `src/input` — keyboard state and stick → camera-relative move vector with each
scene's dead zone, speeds and editor keys as parameters; scenes consume it unchanged in behaviour.

## 8. Do not rewrite without a strong reason

- The game content: maps, builders, materials, lighting, character, HUD, mobile layout.
- `src/core/loop/frame-loop.ts` timing semantics (cadence formula, tolerance 0.8 ms,
  resync on visibility, schedule-before-callbacks) — `frame-loop.test.mjs` pins them to the old behaviour.
- The `updateFrame` / `renderFrame` split point (just before `renderer.info.reset()`).
- Source lines asserted by tests (`editor.stream(editor.active?pivot:player.position)`,
  `createLazyEditor(()=>import(`, NPC override lines in `base/scene.ts`, texts in `Expedition.tsx`).
- The lazy MASTER editor boundary and dependency-graph tests; `src/` boundary rules.
