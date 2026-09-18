# Roadmap — finish the engine refactor and pay down technical debt

Status: 2026-09-15 · repository `mainetethereum-creator/NetrunnerV2`, branch `main`.
Owner goal: remove the technical debt, finish the architecture refactor, and keep the
plan in the repository so any agent (Codex, Claude) can continue without extra context.

This file is the **work queue**. `ARCHITECTURE.md` explains the target design,
`DECISIONS.md` records why, `PROJECT_STATE.md` says what works, `AI_HANDOFF.md` says
what the last session did. Read `AGENTS.md` first — its owner rules override this file.

---

## 1. How to continue (for any agent)

This protocol applies when the user asks to continue the refactor/debt queue.
For a feature, asset, map or documentation request, follow that request and the
task-scoped guidance in `AGENTS.md`; do not start the next architecture item.

1. Use `AGENTS.md` and the current handoff, then read the selected item's
   architecture, decisions and feature notes as needed. Reuse unchanged context.
2. Take the **first item in §3 whose status is `next`** (architecture track) or an
   open item in §4 (debt track) that is not marked *owner*. Do not skip ahead: later
   steps assume earlier ones (ADR-006).
3. One item = one commit on `main`. Never push or deploy without the owner
   (a push to `main` deploys production).
4. Behaviour must not change unless the step says so and an ADR records it.
   Prove "no change" with a unit test that compares against the legacy formula
   (see `tests/input.test.mjs`, `tests/frame-loop.test.mjs`) and with the browser
   protocol in §5.
5. Finish the item: `npm test`, `npm run lint`, `npx tsc --noEmit` (+ `npm run build`
   for steps that touch bootstrap, routes or config), browser checks, then update
   this file (status + verification line), `PROJECT_STATE.md`, `CODEMAP.md`,
   `ARCHITECTURE.md` (§1.3/§4/§5 when boundaries change), `DECISIONS.md` (new ADR
   when a decision was made) and overwrite `AI_HANDOFF.md`.
6. Stop temporary processes/tabs you started. Keep a server or preview available
   when the user requested it for continued work; report what remains running.

**Agents without a visible browser (e.g. Codex CLI):** do not block on browser checks.
- Steps that must not change behaviour (4, 5, 7, 8, 11) may be committed when the unit tests
  prove equality with the legacy code; add the browser checks you could not run to TD-02 and
  say so in `AI_HANDOFF.md`.
- Steps that change behaviour or visuals — **6** (fixed-step movement) and **9** (map data
  parity) — start only after the owner (or an agent with a visible browser) has run the owed
  TD-02 checks and marked them done in the log.
- Reuse a running dev server and existing browser/Blender sessions. Process
  ownership and user-requested server handoff follow `AGENTS.md`.

Status words: `done` · `next` · `planned` · `owner` (needs the owner's decision first).

---

## 2. Definition of done for the whole refactor

- Scene factories (`components/*/scene.ts`) are thin composition: each under ~12 KB,
  readable multi-line formatting, no duplicated renderer / camera / hero / input code.
- Player position, heading and velocity live in `src/gameplay`; Object3D only mirrors them.
- Movement runs in `fixedUpdate` with render interpolation.
- No untyped `window` `CustomEvent`s; UI ↔ engine goes through the typed bus / facade.
- Base and Expedition layouts (spawn, bounds, colliders, stations, POIs, extractions,
  placements) are data in `content/maps`, with visual parity verified.
- The dev map editor saves to `content/maps` files and never reaches production.
- Every runtime asset URL is in `src/assets/registry.ts`; no dead references.
- No feature imports another feature's internals; shared code lives in `src/`.
- `components/` contains only what has not yet been moved, and each remaining file
  has a target in `ARCHITECTURE.md` §4 — or `components/` is gone.
- Tests check behaviour, not exact source lines (source-text assertions are replaced
  as the code they guard moves).

---

## 3. Architecture track

| Step | Title | Status |
|---|---|---|
| 0 | Baseline | done |
| 1 | Asset registry, shared glTF loader and disposal, boundary rules | done |
| 2 | One frame loop `src/core/loop` | done |
| 3 | Movement input `src/input` | done |
| 4 | Follow camera `src/renderer/camera` | done |
| 5 | Hero model and animation `src/renderer/animations/hero` | next |
| 6 | Player state `src/gameplay/player` + fixed-step movement | planned |
| 7 | Typed event bus `src/core/events` | planned |
| 8 | Renderer bootstrap and quality `src/renderer/three`, `src/renderer/quality` | planned |
| 9 | Map data `content/maps` | planned |
| 10 | Dev map editor over `content/maps` | planned |
| 11 | UI modules `src/ui` + typed engine facade | planned |
| 12 | Component/system structure where it helps | planned |

### Step 4 · Follow camera

**Status: done (2026-09-15).** `src/renderer/camera/follow-camera.ts` with `BASE_CAMERA`,
`EXPEDITION_CAMERA`, `METRO_CAMERA`; ADR-022; browser checks still owed (TD-02).

- **Goal:** one isometric follow camera for base, expedition and metro, bit-identical.
- **Today:** each `scene.ts` has `azimuth = 0.48`, a `pivot` Vector3 lerped towards the
  player with `1 - Math.exp(-dt * 8)` (1 with reduced motion), distance by aspect
  (`< 0.85` = portrait), camera at `pivot + (sin(az)·d·0.86, d·0.62, cos(az)·d·0.86)`,
  `lookAt(pivot)`, and editor zoom on wheel.
  - Base: distance 25 / portrait 32; target `player.y + 0.93`; snap when
    `distanceToSquared < 1e-6`; editor holds the pivot; zoom 28 in [8, 65];
    `resetCamera()` copies the target.
  - Expedition: 22 / 28; target `player.y + 1`; no snap; MASTER pans the pivot at
    12 m/s inside 0..144 × 0..72; zoom 22 in [5, 42]; tree editor moves the pivot.
  - Metro: 22 / 28; target y fixed at 1; no editor.
- **Do:** `src/renderer/camera/follow-camera.ts` without a `three` import (so Node tests
  import it): options per scene, operates on the scene's own `pivot` object
  (keep the name `pivot` — `tests/world-editor-streaming.test.mjs` asserts
  `editor.stream(editor.active?pivot:player.position)`; keep `azimuth` —
  `tests/engine-architecture.test.mjs` asserts `input.resolve(moveDirection, azimuth,`).
- **Tests:** `tests/camera.test.mjs` compares pivot and camera position with
  `Object.is` against the legacy three.js `Vector3` code for all three presets over
  random dt / targets / aspects / reduced motion / editor sequences; architecture test
  asserts scenes use the rig and no longer contain the position formula.
- **Browser:** spawn screenshots equal; minimap position after the same key hold equal
  (A/B using a separate baseline checkout); MASTER zoom and pan still work; "Reset camera" in base settings.

### Step 5 · Hero model and animation

- **Goal:** one hero pipeline for three scenes.
- **Today:** each scene loads `ASSET_URLS` hero GLB, fits it to 1.85 m, makes the run
  clip in place, adds `PoseController` idle when there is no Idle clip, blends
  run/idle with `MathUtils.damp(blend, walking ? 1 : 0, 16, dt)` and multiplies by
  `1 - combat.weight` (base, expedition), updates the mixer, applies the pose.
- **Do:** `src/renderer/animations/hero/` — `loadHero()` (load, fit, in-place run,
  idle source) and `createHeroAnimator()` (`update(dt, walking, combatWeight)`).
  Move `components/game/pose-controller.ts` and `run-retarget.ts` there; leave
  `combat-driver.ts`, `class-actions.ts`, `sword-attack.ts` where they are but make
  them consume the animator (split in step 7/11).
- **Tests:** weight math identical to the legacy expression; fit scale identical on a
  synthetic skinned mesh; architecture test: no `PoseController(` in scenes.
- **Browser:** idle and running pose screenshots at spawn identical; combat skill 1–4
  clips play (Warrior / Mage / Ranger).

### Step 6 · Player state and fixed-step movement

- **Goal:** gameplay owns position / heading / velocity; renderer mirrors Object3D.
- **Do:** `src/gameplay/player/player-state.ts` (`{ x, y, z, heading, walking }`),
  `stepPlayer(state, direction, speed, dt, move)` using the existing pure collision
  functions (`base/world.ts moveWithCollision`, `expedition/world.ts move`,
  `metro3d/world.ts move`), path following for tap-to-move, heading damping (14/s).
  `session.tick`, `nearestStation`, snapshots and `editor.stream` read the state.
  Register `fixedUpdate` (1/60 s) for movement; render interpolates with `alpha`.
- **Behaviour change (write an ADR):** simulation becomes frame-rate independent;
  at 60 Hz results equal the old code within 1e-9 m, at other rates positions differ
  slightly but converge. Mobile 30 fps cap no longer changes the simulation cadence.
- **Tests:** stepPlayer vs legacy at 60 Hz; 30/60/144 Hz reach the same point for a
  1 s hold within 1 cm; interpolation never overshoots.
- **Browser:** movement, collisions at base fence and expedition hangar walls,
  tap-to-move routes, extraction, NPC "Talk to" distance.

### Step 7 · Typed event bus

- **Today:** `netrunner:stats`, `netrunner:panel`, `netrunner:cast`, `netrunner:class`,
  `netrunner:input-reset` as `window` `CustomEvent`s in `combat-driver.ts`,
  `GameHud.tsx`, `CharacterPanel.tsx`, `MovementStick.tsx`, `BaseApp.tsx`,
  `Expedition.tsx`, base and expedition `scene.ts`.
- **Do:** `src/core/events/event-bus.ts` with a typed event map and `on/emit/off`;
  one bus per game session passed through scene options; a compatibility bridge
  re-dispatches to `window` until every listener is migrated, then remove it.
  `CombatDriver` stops listening to global `keydown` (skills 1–4 go through
  `src/input/keyboard/action-keys.ts`).
- **Tests:** payload types; bridge delivers both ways; architecture test forbids new
  `netrunner:` strings outside the bridge.

### Step 8 · Renderer bootstrap and quality

- **Do:** `src/renderer/three/create-renderer.ts` (WebGLRenderer, VSM shadows with
  manual updates, ACES + exposure, PMREM environment from sky texture),
  `postprocessing.ts` (lazy composer: MSAA 4 desktop / 2 High on touch, bloom
  0.32 / 0.65 / 1.05, OutputPass), `resize.ts`; `src/renderer/quality/` receives
  `base/quality.ts` and the DPR / budget parts of `expedition/mobile-performance.ts`
  (touch profile detection moves to `src/input/touch`). Per-scene numbers stay
  parameters (metro DPR formula, expedition 1.35 cap, base render ratio).
- **Tests:** existing `base-quality`, `mobile-performance` suites pass unchanged
  after re-export; architecture test: scenes contain no `new T.WebGLRenderer(`.
- **Browser:** screenshots at spawn (desktop High, desktop Lite, mobile 375×812);
  perf stats overlay values in the same range.

### Step 9 · Map data

- **Do, in this order, one commit each:**
  1. `content/maps/base.json`: spawn, bounds, colliders, stations (from `base/world.ts`),
     loaded by `src/world/maps/base.ts` with validation; `base/world.ts` becomes a
     thin adapter; editor overrides stop being module state.
  2. Base building / NPC / prop placements (from builder calls in `base/scene.ts`).
  3. `content/maps/expedition.json`: POIs, extractions, encounters, events, spawn,
     bounds (from `expedition/config.ts`); authored layout placements next.
- **Rule (ADR-008):** before/after screenshots at fixed camera positions must match;
  no new or placeholder content. Collider rectangles must come from the same data as
  the visuals where possible.
- **Tests:** JSON schema validation; loaded data deep-equals the previous constants.

### Step 10 · Dev map editor over `content/maps`

- **Do:** MASTER opens the current map data, select / move / rotate / scale /
  duplicate / delete / add prefab, save to `content/maps/*.json` through a
  development-only route (`route.dev.ts` + `dev.ts` extension only in the development
  phase, like ADR-019). Import existing localStorage documents once.
- **Tests:** `dev-tools.test.mjs` extended: no save route in production; document
  round-trip.

### Step 11 · UI modules

- **Do:** `components/game/{GameHud,MovementStick,CharacterPanel}.tsx` → `src/ui/hud`,
  `src/ui/inventory`; NPC dialogues out of `BaseApp.tsx` → `src/ui/dialogue` (texts
  as data); typed engine facade (`src/core/engine-facade.ts`) instead of ad-hoc handle
  methods; `BaseApp.tsx` / `Expedition.tsx` become composition.
- **Rules:** keep HUD positions and mobile media queries; update `loading-screen`,
  `dev-tools`, `expedition` tests that read JSX source.

### Step 12 · Component/system structure where it helps

- **Do (ADR-007, no big ECS):** interactables (stations, POIs, extraction, supply
  drop), loot, enemies (still behind `EXPEDITION_ENEMIES_ENABLED`) as small
  component + system modules in `src/gameplay`; scenes compose systems.

---

## 4. Technical debt register

| Id | Debt | Where | Fix | Status |
|---|---|---|---|---|
| TD-01 | `ARCHITECTURE.md` §1.1 listed `/` → BaseApp and plain `page.tsx` for dev pages | docs | Routes table matches code | done |
| TD-02 | Browser checks owed. Step 3: Cybersmith route → dialog, mobile stick drag. Step 4 (Browser pane was hidden, no frames ran): spawn screenshots on `/base`, `/expedition`, `/metro`; camera follows while walking; base settings "Reset camera"; MASTER wheel zoom (base, expedition) and WASD/Q pan (expedition); tree editor focus; mobile portrait distance | base, expedition, metro, mobile | Run §5 in a visible browser (compare recorded or separate-checkout baseline if numbers differ) | planned |
| TD-03 | Dead animation references `slash.glb`, `cast.glb` (files absent, never loaded) | `components/game/class-actions.ts` | Remove the entries or register real files | planned |
| TD-04 | Unused `createOneHandedSword` with missing `/game/weapons/sword/01-up.webp` | `components/game/sword-attack.ts` | Delete the unused function and constant | planned |
| TD-05 | Unreferenced district builder | `components/base/district.ts` | Delete (nothing imports it) | planned |
| TD-06 | Unused model `public/base/models/outlaw-refuge.glb` | `public/` | Delete after the owner confirms it is not needed | owner |
| TD-07 | Hardcoded asset URLs in ~15 files | atlases, materials, vegetation, donors | Move into `src/assets/registry.ts`; registry test covers them | planned |
| TD-08 | Cross-feature imports: `base/materials.ts` in expedition/metro; `expedition/mobile-performance.ts` in base and stick; `expedition/config.ts` items in HUD; `expedition/prop-assets.ts` in editor; `expedition/frame-throttle.ts` in editor and vegetation | components | Move each to its `src/` layer (steps 8, 9, 11) or `src/shared` | planned |
| TD-09 | Module-level mutable state: editor overrides in `base/world.ts`; `expedition/world.ts` reads localStorage at import | world | Explicit world instance per scene (step 9) | planned |
| TD-10 | Dense one-line formatting in scenes and builders | `components/**` | Reformat only the code a step touches; keep test-asserted lines | planned |
| TD-11 | Tests assert exact source text | `tests/*` | Replace with behaviour tests when the guarded code moves | planned |
| TD-12 | No automated visual regression | — | Dev-only screenshot script at fixed camera positions (needed by step 9) | planned |
| TD-13 | MASTER toggle overlaps HUD menu on desktop windows < 650 px | `BaseApp.module.css` | Move toggle in the dev-only layout | planned |
| TD-14 | Real tab switching and phone portrait / landscape FPS never tested on a device | — | Owner phone test | owner |

---

## 5. Browser verification protocol

- Check `document.hidden` first: a hidden Browser pane renders nothing (loop `stop` mode).
- When timing is in question, count `requestAnimationFrame` calls over 2 s. A low
  cadence can come from an unfocused pane or busy GPU. Compare recorded evidence
  or a separate baseline checkout; do not stash the shared dirty worktree.
- Movement probe: hold a key for a fixed time, read the minimap position from the
  snapshot; Base W and Expedition D are the reference holds used in steps 2–3.
- Visual probe: screenshot at spawn after load on `/base`, `/expedition`, `/metro`
  (desktop 1536×864 and mobile 375×812).
- Interactions: base "Talk to" at Cybersmith → dialog → Esc; expedition E at the
  breach → extraction timer; mobile stick drag moves the player.
- Reuse the running dev server; clean up temporary sessions under `AGENTS.md`.

---

## 6. Owner-gated product work (not part of the refactor)

- On 2026-09-18 owner reverted the night district except the marked green IMPLANTS building
  (ADR-027). Original Base boundaries/stations/roads restored; Tactical and physical WASD retained.

- Owner authorized Base atmosphere expansion on 2026-09-17; implemented in-place on the existing
  `feature/ui-kit-3d` working branch (ADR-023, `docs/base-night-market.md`). This does not complete
  architecture step 5 or authorize a push/deploy. The existing uncommitted hero extraction is retained.

- Wallet-first access, EVM wallets, Base chain — ADR-016 (open questions listed there).
- NPC portrait art, mobile attack button, hub sections (character / inventory).
- Expedition enemies (`EXPEDITION_ENEMIES_ENABLED`), levels and talents.

---

## 7. Log

| Date | Item | Commit | Verification |
|---|---|---|---|
| 2026-09-15 | Roadmap created; TD-01 | 5947b29 | docs only |
| 2026-09-15 | Step 4 · follow camera | (this commit) | `npm test` 110/110 (`camera.test.mjs`: bit-identical to the legacy code for all three scenes), lint, tsc; `/base` compiles and loads with no server or console errors; visual and interaction checks owed (TD-02) |
| 2026-09-17 | Owner-authorized Base night district (not a refactor step), ADR-023 | uncommitted on existing feature branch | 128 tests, lint, tsc, build; visible district route/E/inventory, rain/train/audio settings, responsive viewport checks; Hub and Expedition load, extraction completes. Physical phone/touch/audio listening still owed. |
| 2026-09-17 | Owner-requested Base third-person camera experiment, ADR-024 | uncommitted on existing feature branch | 134 tests, lint, tsc; visible three-mode switch/V, orbit, zoom, W/Shift+W, route/follow/E and responsive viewport checks. Original shared camera parity still passes; physical touch feel remains owed. No architecture step signoff. |
| 2026-09-18 | Owner chose Tactical only after ARPG comparison; alternative cameras removed, physical WASD retained (ADR-026) | uncommitted on existing feature branch | 130 tests, lint, tsc, diff check. Browser shows Tactical without switches; user had MASTER open, preserved their editor state. Post-cleanup walking/touch check remains; original camera parity passes. |
| 2026-09-18 | Owner reverted district except green IMPLANTS (ADR-027) | uncommitted on existing feature branch | 121 tests, lint, tsc, production build. Original camera parity/station paths and restored west limits pass. Physical-phone checks remain owed. |
| 2026-09-18 | Base MASTER authored scenery deletion/placement (ADR-028; not architecture step 10) | uncommitted on existing feature branch | 135 tests, lint, tsc, build. Visible IMPLANTS delete/Ctrl+Z, crate placement/selection/undo, MASTER close. Browser save covered by unit fixture, actual user save untouched. Physical phone and full Hub/Expedition manual regression owed. |
