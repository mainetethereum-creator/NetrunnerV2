<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project and scope

Netrunner is the CyberBase browser 3D action / extraction RPG: Next.js, React,
Three.js and wagmi. Work in this repository, in place; do not create a replacement
game or parallel app. Implement the user's current request, including necessary
local fixes and verification. The architecture backlog is not permission to
start unrelated work.

Routes: `/` Hub → PLAY → `/base`; `/expedition` Outlands; `/metro` frozen
prototype. Wallet-first access with Base as primary chain is planned (ADR-016);
do not add new guest-only flows. Development routes are `/editor/vegetation`
and `/ui-kit-preview`.

## Context to read

Use the files relevant to the task; reuse context already read unless it changed.
- `AI_HANDOFF.md`: current work, saved map/camera and outstanding checks.
- `PROJECT_STATE.md`: implemented features and known limitations.
- `CODEMAP.md`: locate modules; `ARCHITECTURE.md`: layer boundaries and refactors.
- `DECISIONS.md`: relevant owner decisions; newer decisions supersede older ones.
- Feature notes in `docs/`: Base editor, camera, reference buildings, railway or UI kits.
- `ROADMAP.md`: only when continuing the architecture/debt queue; follow the
  requested item's prerequisites and completion checks.
Load a skill when its workflow is relevant or the user requests it; do not load
unrelated skills just because their descriptions share a keyword.

## Working to completion

Carry an implementation through the requested behavior, relevant checks and fixes
for regressions it causes. Routine local edits, asset generation, tests and inspection
are authorized within the request; do not stop after a first draft for approval.
Ask only when a missing choice materially changes the result or additional authority
is needed. If blocked, state the concrete blocker and what remains unverified.

Preserve unrelated working-tree edits and the owner's browser map/camera saves.
Before a reload that could discard unsaved editor work, save/export that layout.
Do not reset/import older map data or change the camera for convenience.
When the owner says they will perform visual checking, respect that preference
and report which checks you completed.

## Machine and process ownership

This machine has overheated from leaked servers and helpers. Reuse existing dev
servers, browser tabs and Blender sessions; check before starting another.
Stop temporary processes/tabs you created when finished, but keep a server or
preview running when the user requested it for continued work. Report that handoff.
Do not stop user-owned sessions. Run heavy checks sequentially.
Use subagents only when explicitly requested or required by applicable instructions.

For slowness, `powershell -File scripts/agent-processes.ps1` is a read-only
diagnostic. Inspect its candidates; do not use blanket cleanup to terminate another
task's helpers. Keep process ownership clear.

## Architecture and game invariants

- Preserve maps, models, materials, lighting, character, camera, controls,
  interactions and mechanics except for changes the user requests.
- Refactor incrementally; no large ECS rewrite. Three.js is the renderer layer:
  new gameplay state belongs outside Object3D. Map-data extraction requires
  verified visual parity.
- Editors stay out of production gameplay: development pages use `page.dev.tsx`;
  in-game tools require `process.env.CYBERBASE_DEV_TOOLS === "1"`.
- `app/` holds routes; legacy features remain in `components/`; shared engine
  layers live in `src/`. Follow boundaries in `ARCHITECTURE.md` and ESLint.
- Register runtime assets from `public/` in `src/assets/registry.ts`.
  Preserve shared GPU resource ownership and teardown.
- In `src/`, use readable TypeScript and relative imports with explicit `.ts`.
  Retain exact source lines asserted by tests or update those tests deliberately.
- Do not add `netrunner:*` window events; the existing bridge awaits typed events.

## Verification and handoff

Choose checks that can detect problems caused by the change:
- Documentation/instruction-only edits: check content, local references and diff.
  Do not build or start the game for text changes.
- Code changes: affected behavior tests, `npm run lint`, `npx tsc --noEmit`.
  Run `npm test` for shared logic, map/navigation changes and refactor completion.
- Run `npm run build` for routes/config/bootstrap, production boundaries or major
  integrations. Avoid repeating passed checks without new changes or evidence.
- Visual/gameplay changes: inspect the affected visible scene and relevant
  movement, camera, collision or interaction paths. Shared/mobile changes need
  matching route/viewport checks. Full refactor protocol: `ROADMAP.md` §5.

A hidden page pauses rendering; check `document.hidden` before judging behavior.
Measure frame cadence when investigating timing issues. For baseline comparisons,
use a separate checkout or recorded evidence; do not stash a dirty shared workspace.
Fix regressions introduced by the task; report pre-existing failures separately.
State what was actually tested and any checks still owed.

Update the feature notes/current handoff when behavior changes. Update the project
state, code map, architecture or decisions only when their contents change.
Keep `AI_HANDOFF.md` current; historical decisions belong in ADRs and the roadmap log.

## Commands and release boundaries

`npm run dev` serves http://localhost:3000. Tests use `npm test` (Node test runner).
`npm ci` installs dependencies; lint, typecheck and build commands are above.
The owner-authorized architecture track uses one item/commit on `main` (ADR-020);
ordinary feature work stays on the current branch unless instructed otherwise.
Never commit `.env*` or `.vercel/`. Never push or deploy without the owner:
a push to `main` of `mainetethereum-creator/NetrunnerV2` deploys production.
