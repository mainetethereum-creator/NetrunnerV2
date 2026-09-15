# AI handoff — 2026-09-15 · roadmap + architecture step 4 (follow camera)

Author: Claude (Opus 5). Read `AGENTS.md` first. Repository: `github.com/mainetethereum-creator/NetrunnerV2`, branch `main` (ADR-020).
Owner request: remove technical debt, finish the architecture refactor, and keep the plan in the
repository so Codex (or any agent) can continue.

## 1. What was done

- **`ROADMAP.md` (new, commit 5947b29):** the work queue. Architecture steps 4–12 with goal, current
  code, what to build, tests and browser checks per step; definition of done for the refactor;
  technical debt register TD-01…TD-14; browser verification protocol; owner-gated product work; log.
  `AGENTS.md` now lists it in the reading order. `ARCHITECTURE.md` §1.1 routes table fixed (TD-01).
- **Step 4 · follow camera:** `src/renderer/camera/follow-camera.ts` — `createFollowCamera(preset, pivot)`
  with presets `BASE_CAMERA`, `EXPEDITION_CAMERA`, `METRO_CAMERA` (ADR-022). Base, expedition and metro
  `scene.ts` no longer contain the lerp / distance / position formula, `desiredPivot`, `followTarget` or
  `editorZoom`; they call `cameraRig.follow`, `cameraRig.place(camera.position, camera.aspect, editorActive)`,
  `camera.lookAt(pivot)`, `zoomBy`, `pan`, `nudge`, `moveTo`, `snapToTarget`.

## 2. Files

Created: `ROADMAP.md`, `src/renderer/camera/follow-camera.ts`, `tests/camera.test.mjs`.
Changed: `components/{base,expedition,metro3d}/scene.ts`, `tests/engine-architecture.test.mjs`,
`AGENTS.md`, `ARCHITECTURE.md`, `CODEMAP.md`, `DECISIONS.md` (ADR-022), `PROJECT_STATE.md`, this file.
Local only (not committed): `.claude/launch.json` (dev server config for the Claude Browser pane).

## 3. Verification

- `npm test` 110/110 — `camera.test.mjs` compares the rig with the legacy three.js code on 6 000 random
  frames per scene using `Object.is` (bit-identical). `npm run lint` clean, `npx tsc --noEmit` clean.
- Browser: `/base` compiled and loaded with no server or console errors, but the Browser pane was hidden
  (`document.hidden`, 0×0), so no frames ran. **Owed checks are listed in `ROADMAP.md` TD-02** — run them
  first in the next session with a visible browser.
- `npm run build` not run (no bootstrap or config change).

## 4. Commands

```bash
cd "D:\V2 Cyber\Netrunner"
npm test
npm run lint
npx tsc --noEmit
npm run dev        # http://localhost:3000  (/, /base, /expedition, /metro)
```

Stop the dev server when finished.

## 5. Next

1. TD-02 browser checks (steps 3 and 4) in a visible browser.
2. `ROADMAP.md` step 5: hero model and animation (`src/renderer/animations/hero`).
3. Quick debt items without owner input: TD-03 (dead `slash.glb` / `cast.glb` entries), TD-04
   (unused `createOneHandedSword`), TD-05 (unreferenced `components/base/district.ts`). TD-06 needs the owner.

## 6. Do not rewrite without a strong reason

- Test-asserted source lines: `editor.stream(editor.active?pivot:player.position)` (base, expedition),
  `input.resolve(moveDirection, azimuth,` (all scenes), `createLazyEditor(()=>import(`, `import('./tree-editor')`.
  Keep the names `pivot`, `azimuth`, `cameraRig`.
- Earlier steps: frame loop timing (`frame-loop.test.mjs`), `src/input` arithmetic (`input.test.mjs`),
  camera arithmetic (`camera.test.mjs`). Change them only with a test proving the new behaviour and an ADR.
- Development tools never reach players (ADR-019). HUD positions and mobile media queries stay as tuned.
