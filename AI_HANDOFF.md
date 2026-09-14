# AI handoff — 2026-09-14 · architecture refactor step 3

Author: Claude (Opus 5). Read `AGENTS.md` first. Branch: `refactor/engine-architecture`.

## 1. What was done in this step

- **Movement input layer** `src/input/`:
  - `movement-input.ts` — `createMovementInput()`: held keys (`keys`), stick (`setStick` clamps to
    [−1, 1], non-finite → 0; `clearStick`; `clear`), `running` (Shift) and
    `resolve(out, azimuth, deadZone, bindings)` → camera-relative world direction, returns
    `false` inside the dead zone. Arithmetic is copied from the scenes, statement by statement.
  - `keyboard/move-keys.ts` — `MOVE_KEYS` (WASD + arrows), `EDITOR_PAN_KEYS` (Q also means back
    while the expedition MASTER editor pans), `RUN_KEY`, `keyAxis`.
  - `touch/stick-vector.ts` — `stickVector` (moved; `components/expedition/mobile-performance.ts`
    re-exports it, `MovementStick.tsx` imports the new path).
- **Scenes use it** without behaviour change: base (dead zone 0.12, walk 3.1 / run 5),
  expedition (0.1, 4 / 6, editor pan bindings), metro (0.1, 3.1 / 5).
  Scenes still own when movement is allowed, speeds, `preventDefault` and action keys.
- Tests: `tests/input.test.mjs` (bit-identical to the legacy formula, clamping, re-export);
  `tests/engine-architecture.test.mjs` asserts scenes resolve movement through `src/input`.
- Docs: `ARCHITECTURE.md`, `CODEMAP.md`, `DECISIONS.md` (ADR-013), `PROJECT_STATE.md`,
  `AGENTS.md` (browser-check note), this file.

Previous steps: 1 asset registry + shared glTF loader/disposal + boundaries; 2 shared frame loop
(ADR-012). See git history.

## 2. Files

Created: `src/input/movement-input.ts`, `src/input/keyboard/move-keys.ts`,
`src/input/touch/stick-vector.ts`, `tests/input.test.mjs`.
Changed: `components/base/scene.ts`, `components/expedition/scene.ts`,
`components/metro3d/scene.ts`, `components/expedition/mobile-performance.ts`,
`components/game/MovementStick.tsx`, `tests/engine-architecture.test.mjs`, docs above.

## 3. Key decisions

- ADR-013: input owns keys, stick and the key/stick → world-direction formula; gameplay policy
  (can move? speed? modal? editor?) stays in the scenes until player state is extracted (step 6).
- The metro stick is now clamped like the other scenes (its UI already sends clamped values).

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
2. WASD / arrows / Shift movement speed feels unchanged; the camera follows.
3. Area map → Cybersmith → "Talk to cybersmith" → dialog → Esc (not re-run in step 3, see §6).
4. `/expedition`: E at the breach starts extraction; MASTER open → W/A/Q/D pan the editor pivot.
5. Phone or touch emulation: stick moves the player in portrait and landscape (not re-run in step 3).

## 6. Known issues

- **Browser pane frame rate:** in this session the Claude Browser pane ran at 2–5 frames per
  2 s while unfocused and while other GPU-heavy apps were running, although
  `document.hidden` was false. Absolute distances then differ from earlier steps. Measure
  requestAnimationFrame calls first; if they are low, compare against `HEAD` with
  `git stash -u` under the same conditions (done for step 3: bit-identical).
- Rest: see `PROJECT_STATE.md` (architecture problems in `ARCHITECTURE.md` §3, dead asset
  references, phone checks pending).

## 7. Next recommended step

Step 4: camera rig — fixed-angle follow camera shared by the three scenes, no behaviour change.
Owner request in progress: integrate the CyberBase Hub / in-game HUD / Dialogue UI kits
(separate commits, see the next handoff).

## 8. Do not rewrite without a strong reason

- Game content: maps, builders, materials, lighting, character, HUD, mobile layout.
- `src/core/loop/frame-loop.ts` timing semantics and the `updateFrame` / `renderFrame` split.
- `src/input/movement-input.ts` arithmetic order (`input.test.mjs` compares with `===`).
- Source lines asserted by tests (`editor.stream(editor.active?pivot:player.position)`,
  `createLazyEditor(()=>import(`, NPC override lines in `base/scene.ts`,
  `Boolean(state.near)||state.extraction>0`, "EXPEDITION OBJECTIVE", "LOCAL SIGNAL" in `Expedition.tsx`).
- The lazy MASTER editor boundary and dependency-graph tests; `src/` boundary rules.
