# Architecture Decision Log

Newest decisions at the end. Never rewrite an accepted ADR; supersede it.

---

## ADR-001: Netrunner is the CyberBase codebase; refactor in place
**Status:** accepted (2026-09-14, owner)
**Decision:** The existing Netrunner game is the product. No replacement project,
no parallel skeleton, no migration into a separate repository. Architecture work
happens incrementally inside this repository. Existing maps, assets, gameplay, UI
and controls must be preserved.
**Reason:** the game already works and contains months of content; rebuilding it
would lose working behaviour. (A separate `D:\V2 Cyber\CyberBase` monorepo was
created by mistake and is paused.)
**Consequences:** every refactor step must keep the game running and visually identical.

## ADR-002: Strangler-style migration into `src/` layers
**Status:** accepted
**Decision:** New engine layers live in `src/` (`core`, `gameplay`, `world`, `input`,
`renderer`, `ui`, `assets`, `shared`). Legacy `components/` modules are moved or
wrapped one concern at a time; scenes become thin composition. Routes stay in `app/`.
**Reason:** small, reversible steps; each commit is reviewable and testable.
**Consequences:** for a while both structures coexist; `ARCHITECTURE.md` §4 maps old → new.

## ADR-003: Boundaries are enforced from the first commit
**Status:** accepted
**Decision:** `eslint.config.mjs` forbids `src/{core,gameplay,world,input,shared}` and
`src/assets/registry.ts` from importing `three`, React/Next or legacy `components/`,
and forbids any `src/` file from importing `components/`. `tests/engine-architecture.test.mjs`
checks the same without relying on lint.
**Reason:** layering degrades quickly without automation, especially with several AI agents.

## ADR-004: Three.js becomes the renderer layer gradually
**Status:** accepted
**Decision:** Three.js code is concentrated in `src/renderer`. Gameplay state
(player position, heading, velocity) moves out of Object3D into gameplay state that
the renderer reads. Until then, adapters wrap the existing scene code.
**Reason:** today Object3D is the source of truth, and gameplay reads it directly.

## ADR-005: Shared asset registry
**Status:** accepted (stage 1)
**Decision:** Runtime asset URLs are declared in `src/assets/registry.ts` (plain data)
and loaded through shared helpers (`createGltfLoader`). A test verifies registered files exist.
**Reason:** URLs were hardcoded and duplicated; dead references went unnoticed.
**Consequences:** remaining hardcoded paths (atlases, materials, vegetation, UI images,
animation donors) move into the registry in later steps.

## ADR-006: Loop, input and camera are extracted before gameplay state
**Status:** accepted
**Decision:** Order of work: loop wrapper → input → camera → hero animation → player
state → typed events → renderer bootstrap → map data → editor → UI → ECS-style systems.
**Reason:** the first extractions are mechanical and identical in all scenes, so they
remove duplication with low risk and make the later state changes smaller.

## ADR-007: No big ECS rewrite
**Status:** accepted
**Decision:** Introduce component/system structure only where it simplifies real
systems (interactables, enemies, loot) after player state and map data are extracted.
**Reason:** the owner asked not to rewrite for ECS; current systems are small.

## ADR-008: Maps become data after visual parity is guaranteed
**Status:** accepted
**Decision:** Base and Expedition layouts are extracted to `content/maps` / `content/prefabs`
piece by piece, verifying identical visuals with before/after screenshots at fixed
camera positions. No new or placeholder maps.
**Reason:** layouts are currently code and colliders are duplicated separately.

## ADR-009: Editors stay dev tools outside the gameplay graph
**Status:** accepted
**Decision:** MASTER and the vegetation editor remain lazily loaded dev tools;
tests keep asserting they are not in the static gameplay import graph. The future
map editor edits `content/maps` JSON and is excluded from production builds.

## ADR-010: Git workflow for the refactor
**Status:** accepted
**Decision:** Work on `refactor/engine-architecture`. Commit e153744 snapshots the
pre-existing uncommitted work; each architecture step is a separate commit.
No pushes or merges without the owner's request.

## ADR-011: Test-importable modules use explicit `.ts` imports
**Status:** accepted
**Decision:** Modules in `src/` (and any module imported by `node:test` suites) use
relative imports with `.ts` extensions (`allowImportingTsExtensions` is enabled).
**Reason:** tests run with Node's type stripping and no bundler, which cannot resolve extensionless imports.

## ADR-012: One frame loop with fixedUpdate → update → render
**Status:** accepted (step 2)
**Decision:** `src/core/loop/frame-loop.ts` schedules frames for all scenes. It owns
requestAnimationFrame, hidden-tab handling (`stop` for base and expedition, `skip`
for metro — each scene's previous behaviour), the mobile cadence cap (`targetFps`),
the 0.05 s delta clamp, and the phases `fixedUpdate × N → update → render` with an
interpolation `alpha`. Scenes pass `updateFrame` (everything before the render call)
and `renderFrame` (render, stats, snapshot). Base stops the loop on WebGL context loss;
expedition keeps running as before.
**Reason:** the same loop existed three times; one tested loop is the seam for a
fixed-step simulation.
**Consequences:** `tests/frame-loop.test.mjs` proves frame timing equals the old code on
identical timestamps. Scenes do not use `fixedUpdate` yet: while Object3D is the source
of truth there is no interpolation, so fixed steps would stutter on high-refresh
displays. Movement adopts it in step 6.
