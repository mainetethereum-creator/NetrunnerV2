# Netrunner / CyberBase — architecture

Status: 2026-09-15, repository `mainetethereum-creator/NetrunnerV2`, branch `main` (ADR-020); refactor steps 1–3 done.

**Owner decision:** Netrunner *is* the CyberBase game. There is no replacement
project. The architecture is improved incrementally, in place, without losing
any working map, asset, mechanic, UI or control. See `DECISIONS.md`.

This document has two halves: how the game is built **today** (§1–3), and where
it is going and how we get there safely (§4–6).

---

## 1. What runs today

Stack: Next.js 16.3 (App Router, Turbopack), React 19.2, three 0.185, wagmi/viem
(Base wallet), `node:test` with `--experimental-strip-types` for tests.

### 1.1 Entry points

| Route | Page | Client root (React) | Engine factory (Three.js) |
|---|---|---|---|
| `/` | `app/page.tsx` | `src/ui/hub/HubApp.tsx` (hub, no Three.js) | — |
| `/base` | `app/base/page.tsx` | `components/base/BaseApp.tsx` | `components/base/scene.ts` → `createBaseScene` |
| `/expedition` | `app/expedition/page.tsx` | `components/expedition/Expedition.tsx` | `components/expedition/scene.ts` → `createExpedition` |
| `/metro` | `app/metro/page.tsx` | `components/metro3d/Metro3D.tsx` | `components/metro3d/scene.ts` → `createMetro` (frozen prototype) |
| `/editor/vegetation` | `app/editor/vegetation/page.dev.tsx` | `components/editor/VegetationEditor.tsx` | `components/editor/preview.ts` (development only, ADR-019) |
| `/ui-kit-preview` | `app/ui-kit-preview/page.dev.tsx` | `app/ui-kit-preview/preview.tsx` | — (UI sandbox, development only) |

`app/layout.tsx` loads the Martius font and wraps everything in
`components/providers/Web3Provider.tsx` (wagmi + react-query, config in `lib/wagmi.ts`).

### 1.2 Runtime pattern (the same shape three times)

```
React root (use client)
  └─ useEffect → import('./scene') → createXScene(host, callbacks)
        returns an imperative handle: setStick, setPaused, interact, setMaster, dispose, …
  engine → React: throttled snapshot callback (position, fps, near, bag, …) at ~5–8 Hz
  React → engine: handle methods;  global window events for HUD/combat (see 1.3 "state")
```

Each scene factory currently creates and owns **everything** at once:
WebGLRenderer + EffectComposer/bloom (desktop), PMREM environment, lights, level
geometry, glTF/Draco loading, the player `Object3D`, keyboard/pointer listeners,
the follow camera, AnimationMixer + PoseController + CombatDriver, adaptive
quality / mobile DPR, per-frame `updateFrame` / `renderFrame` phases (since step 2
the scheduling, hidden-tab handling and mobile cadence cap come from
`src/core/loop`), a modal `MutationObserver`, the lazily loaded MASTER
editor, and the snapshot bridge to React.

### 1.3 Where each concern lives today

| Concern | Base (`/base`) | Expedition (`/expedition`) | Shared / notes |
|---|---|---|---|
| Three.js scene setup | `base/scene.ts` (renderer, composer, lights, PMREM) | `expedition/scene.ts` | duplicated; `metro3d/scene.ts` too |
| Renderer quality | `base/quality.ts` (desktop auto High/Lite) | inline | `expedition/mobile-performance.ts` (mobile DPR budget, 30 fps fallback) used by both |
| Player | `player` Group + `hero` GLB root inside `base/scene.ts` | same in `expedition/scene.ts` | **position/heading stored on Object3D** |
| Character model & animation | hero load, fit to 1.85 m, in-place RUN, `game/pose-controller.ts` idle, locomotion blend | same code | `game/combat-driver.ts` plays attack clips, `class-actions.ts` retargets `shoot.glb`, `sword-attack.ts` builds the sword |
| Movement | `base/world.ts`: `canStand`, `moveWithCollision`, `findPath` (0.5 m BFS) | `expedition/world.ts`: `makeWorld` (spatial grid, terrain elevation), `move` (step limit), `findRoute` | speeds: base 3.1 / 5 (Shift), expedition 4 / 6 |
| Collisions | rectangles `COLLIDERS` + bounds `LIMIT` + editor rects in `base/world.ts` | authored/dressing/tree/editor rectangles in a spatial grid (`expedition/world.ts`) | player is a circle r≈0.32–0.34 |
| Camera | isometric follow in `animate()`: azimuth 0.48, distance 25 (portrait 32), pivot damping 8/s, MASTER zoom | same, distance 22 (portrait 28) | duplicated |
| Input | window keydown/keyup (WASD/arrows, Shift, E), tap-to-move raycast, `setStick` | + Space fire, MASTER keys | 1–4 skills in `CombatDriver`, I inventory in `GameHud`, H hide HUD in `BaseApp`; movement keys + stick are resolved by `src/input/movement-input.ts` (step 3) |
| Mobile controls | `game/MovementStick.tsx` → `engine.setStick`; `stickVector` dead zone | same | `usesTouchProfile`, CSS media queries, `netrunner:input-reset` on blur/modals |
| Map generation | procedural code: `base/scene.ts` (box/cylinder/pipe/sign/light helpers → instanced batches, merged static meshes), `zones.ts`, `metro.ts`, `buildings.ts`, `fence.ts`, `details.ts`, `npc.ts`, 3 GLB buildings | `config.ts` (POIs, extractions, encounters, events), `authored-layout.ts`, `terrain.ts`/`landscape*.ts`, `environment.ts` (24 m chunks, instancing, labels, lights), procedural `cyber-buildings`, `building-props`, `city-props`, `security-fences`, `microbus`, `nature`, `dressing`, `street-detail`, baked vegetation, grass | `base/materials.ts` PBR surfaces shared by all three scenes |
| Map objects / editing | MASTER (`world-editor/controller.ts`) over authored NPCs + props | MASTER props, tree editor, landscape studio | documents in `world-editor/document.ts`, saved to **localStorage** only |
| Interactions | `STATIONS` + `nearestStation` (2.05 m) → `BaseApp` dialogues; route buttons to `/expedition`, `/metro` | `ExpeditionSession.interact` (POIs, extraction timer, supply drop) → prompt in `Expedition.tsx` | |
| Expedition logic | — | `expedition/session.ts` (pure): hp, bag, discovery, loot tables, encounters (disabled by flag), events, extraction, death loss | stash banking in `Expedition.tsx` (localStorage) |
| Base logic | quest + dialogues in `BaseApp.tsx` (localStorage) | — | |
| Assets | `public/base/*`, `public/game/*`, `public/vegetation/*`, canvas textures | atlases, baked vegetation | URLs were hardcoded in ~15 files; registry started in `src/assets/registry.ts` |
| State management | React state/refs; module-level mutable state in `base/world.ts` (editor overrides) | `ExpeditionSession` object; `expedition/world.ts` reads saved trees from localStorage at import | window `CustomEvent`s: `netrunner:stats`, `netrunner:panel`, `netrunner:cast`, `netrunner:class`, `netrunner:input-reset`; localStorage keys for quest, stash, combat class, character draft, editor docs |

---

## 2. Dependency map (measured 2026-09-14)

```
app/* ─────────► components/{base,expedition,metro3d,editor}/<Root>.tsx      (React, client)
<Root>.tsx ──dynamic import──► <feature>/scene.ts                           (Three.js engine factory)

scene.ts ──► world.ts, session.ts, config.ts, quality.ts                    (pure logic, no three/react)
         ──► game/combat-driver.ts, game/pose-controller.ts                  (three + window events)
         ──► environment / map builders                                      (three)
         ──► world-editor/lazy-editor.ts ──dynamic──► controller.ts          (MASTER, three, prop library)
         ──► expedition/mobile-performance.ts                                (pure + matchMedia input)
         ──► src/renderer/three/*, src/assets/registry.ts, src/core/loop, src/input   (new layers)

game/GameHud.tsx, CharacterPanel.tsx ◄── window CustomEvents ──► game/combat-driver.ts
```

Cross-feature couplings to untangle later:

- `base/materials.ts` is used by expedition and metro environments.
- `expedition/mobile-performance.ts` is used by the base scene and `game/MovementStick.tsx`.
- `expedition/config.ts` (`ITEMS`, `LootKind`) is used by `game/GameHud.tsx`, `game/CharacterPanel.tsx` and vegetation.
- `expedition/prop-assets.ts` is used by `world-editor/controller.ts` and `base/BaseEditorPanel.tsx`.
- `expedition/frame-throttle.ts` is used by `world-editor/controller.ts` and vegetation.

Already renderer-independent (no three/react imports): `base/world.ts`, `base/quality.ts`,
`expedition/{config,session,world,terrain,landscape-state,authored-layout,dressing-layout,nature-layout,microbus-layout,fence-layout}.ts`,
`game/{combat,character-draft}.ts`, `metro3d/world.ts`, `vegetation/format.ts`,
`world-editor/document.ts`. These are the first candidates to move into `src/`.

Tests (`tests/*.test.mjs`, 79 at baseline) import several of these `.ts` files
directly through Node; some also read scene source text and assert exact lines.

---

## 3. Architecture problems (prioritized)

1. **Monolithic scene factories.** `base/scene.ts` (≈41 KB) and `expedition/scene.ts` mix renderer, input, camera, gameplay update, animation, combat, quality, editor and UI bridge.
2. **Triplicated engine code** across base / expedition / metro: renderer + composer setup, hero load/normalization and in-place run, camera follow, tap-to-move, light pool, snapshot reporting. (glTF/Draco loader and disposal were removed in step 1; the rAF + visibility loop in step 2; the keyboard/stick movement vector in step 3.)
3. **Object3D is the source of truth** for player position and heading (`player.position`, `hero.rotation.y`); gameplay (`session.tick(dt, player.position)`, `nearestStation(player.position)`) reads Three.js objects.
4. **No fixed timestep.** Movement integrates with frame `dt` clamped to 0.05 s; the mobile frame limiter changes the simulation cadence. The shared loop already provides `fixedUpdate` with an interpolation `alpha`; scenes adopt it once player state leaves Object3D (step 6).
5. **Implicit global event bus.** Untyped `window` `CustomEvent`s with string names spread across files; `CombatDriver` listens to global keydown.
6. **Map content lives in code.** Base layout coordinates are in builder calls; collision rectangles are maintained separately in `base/world.ts` and can drift from visuals. Editor changes exist only in one browser's localStorage.
7. **Module-level mutable state** (`base/world.ts` editor overrides; `expedition/world.ts` reads localStorage at import time).
8. **Features import each other's internals** (see §2) instead of a shared layer.
9. **Asset references are scattered**; dead references exist: `class-actions.ts` declares `slash.glb`/`cast.glb` (never loaded, files absent), `sword-attack.ts` references `/game/weapons/sword/01-up.webp` (only used by the unused `createOneHandedSword`, file absent); `public/base/models/outlaw-refuge.glb` is not referenced.
10. **Dense one-line formatting** in several files and **tests that assert exact source text** make safe refactors harder.
11. **Editor lives inside the game** (MASTER). It is lazily loaded and tested to stay out of the normal graph, which is good, but it cannot save to committed map files.
12. **No automated visual regression**; mobile/FPS validation is manual.

---

## 4. Target architecture and boundaries

New code goes into `src/`, which Next.js treats as a plain source folder (the
routes stay in the root `app/`). Legacy `components/` keep working and are
migrated into these layers step by step.

```
src/shared    ← nothing                              math, ids, data helpers
src/core      ← shared                               engine lifecycle, loop (update / fixedUpdate / render), typed events
src/assets    ← shared                               registry (pure data); loaders that need three live in src/renderer
src/world     ← shared, core                         maps, entities, prefabs, loading, collision queries
src/gameplay  ← shared, core, world                  player, movement, health, energy, interactions, expedition session
src/input     ← shared, core                         keyboard, touch, mobile stick → input state
src/renderer  ← shared, core, assets, world, gameplay (read-only), three    scene, camera, lighting, materials, animations
src/ui        ← shared, gameplay read models, react  hud, hub, dialogue, inventory
app/, components/ (legacy)  ← may use anything while migrating
content/      JSON maps, prefabs and asset data (introduced when map extraction starts)
```

Rules:

- `src/{core,gameplay,world,input,shared}` and `src/assets/registry.ts` never import
  `three`, React/Next or legacy `components/`. **Enforced** by `eslint.config.mjs`
  and `tests/engine-architecture.test.mjs`.
- No `src/` module imports legacy `components/` (lint): code moves *into* `src/`, never the other way round.
- The renderer reads gameplay/world state and owns every Object3D; gameplay never
  stores state in Object3D (reached gradually, step 6 below).
- UI talks to the engine through a typed facade; `netrunner:*` window events stay
  as a compatibility bridge until the UI is migrated.
- Editors are dev tools loaded lazily and must stay out of the production gameplay graph.

Where today's modules are headed:

| Today | Target |
|---|---|
| `base/world.ts`, `expedition/world.ts`, `metro3d/world.ts`, `terrain.ts`, `*-layout.ts` | `src/world/maps/*` (+ data in `content/maps`) |
| `expedition/session.ts`, `expedition/config.ts` rules | `src/gameplay/expedition` |
| `game/combat.ts` (`CombatState`) | `src/gameplay/combat` |
| `game/combat-driver.ts` | split: gameplay (state) / input (1–4) / renderer (clips, weapon visuals) |
| `game/pose-controller.ts`, `run-retarget.ts`, `class-actions.ts`, `sword-attack.ts`, hero loading in scenes | `src/renderer/animations` |
| camera code in scenes | `src/renderer/camera` |
| renderer/composer/PMREM/light setup in scenes, `base/quality.ts`, DPR parts of `mobile-performance.ts` | `src/renderer/three`, `src/renderer/quality` |
| `base/materials.ts`, `wetness.ts` | `src/renderer/materials` |
| keyboard/pointer code in scenes, `stickVector` | `src/input/{keyboard,touch,mobile}` (movement keys, stick and `stickVector` done in step 3; action keys and tap-to-move pending) |
| rAF/visibility loops in scenes | `src/core/loop` (done in step 2) |
| `netrunner:*` events | `src/core/events` |
| `game/GameHud.tsx`, `MovementStick.tsx`, `CharacterPanel.tsx`, dialogues in `BaseApp.tsx` | `src/ui/{hud,dialogue,inventory}` |
| `world-editor/*` (MASTER), vegetation editor | dev map editor working on `content/maps` JSON |
| scene factories | thin composition of the layers above |

---

## 5. Safe refactor plan

Every step is one commit on `main` of NetrunnerV2. After every step the
game must start, the maps must look the same, and movement, camera, mobile
controls and interactions must still work (checklist in `AGENTS.md`).

| Step | What | Status |
|---|---|---|
| 0 | Baseline: branch, snapshot commit of pre-existing work, baseline checks (79 tests, lint, tsc), before-screenshots of `/` and `/expedition` | done |
| 1 | `src/assets/registry.ts`, shared `createGltfLoader` and `disposeObjectTree` used by all three scenes; boundary lint rules + `tests/engine-architecture.test.mjs` | done |
| 2 | `src/core/loop`: one frame loop for all scenes (rAF, hidden-tab `stop`/`skip` modes, mobile cadence cap, delta clamp) with `fixedUpdate → update → render` phases; scenes split into `updateFrame` / `renderFrame`; fixed steps stay unused until step 6 | done |
| 3 | `src/input`: held keys + stick → camera-relative move direction (`createMovementInput`, per-scene dead zone and editor pan bindings as parameters); `stickVector` moved; walk/run speeds and movement gating stay in scenes | done |
| 4 | `src/renderer/camera`: isometric follow (azimuth, distances, portrait, damping, editor zoom) | next |
| 5 | `src/renderer/animations/hero`: shared hero load, fit, in-place run, PoseController idle, locomotion blend, combat overlay | |
| 6 | `src/gameplay/player`: position/heading/velocity owned by gameplay; renderer syncs Object3D; session and stations read gameplay state; movement moves to `fixedUpdate` with render interpolation | |
| 7 | `src/core/events`: typed event bus behind the existing `netrunner:*` bridge | |
| 8 | Shared renderer bootstrap and quality controllers (desktop + mobile) | |
| 9 | Map data: move Base stations/spawn/colliders, then building/NPC placements to `content/maps/base.json` with visual parity checks; then Expedition POIs/extractions/encounters | |
| 10 | Dev map editor over `content/maps` (open current map, select, move/rotate/scale, duplicate, delete, add prefab, save), excluded from production | |
| 11 | UI modules into `src/ui` | |
| 12 | Component/system (ECS-style) structure only where it clearly helps (interactables, enemies, loot) | |

---

## 6. Conventions for code in `src/`

- TypeScript; relative imports inside `src/` use explicit `.ts` extensions so `node:test` can import modules directly (the tests run without a bundler).
- Readable multi-line formatting; comments explain *why*.
- When a legacy test asserts exact source text, keep that line intact or change the test deliberately in the same commit.
