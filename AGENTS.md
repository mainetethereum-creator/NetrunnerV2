<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Process hygiene (Claude and Codex)

This machine has repeatedly overheated (CPU ~80C, 500-600 running processes)
because agent sessions started dev servers, browsers, and MCP helper
processes (`uv.exe`, `python.exe`, `StudioMCP.exe`, browser automation) and
never stopped them. Follow these rules in every session working in this repo:

- Before starting a dev server or browser preview, check whether one is
  already running (`preview_list`, or an existing terminal/task) and reuse it
  instead of starting another.
- Stop every server, browser tab, and background task you started
  (`preview_stop`, closing browser tabs, `TaskStop`) before ending a task or
  handing off — even if the user did not ask for cleanup.
- Do not spawn subagents or extra tool processes unless the task genuinely
  needs them or the user asks for it.
- If the machine feels slow, run `powershell -File scripts/agent-processes.ps1`
  (dry run; add `-Stop` to terminate the known MCP-helper processes it
  reports — `uv.exe`, `python.exe`, `StudioMCP.exe`) to clear what has leaked.

## What this project is

Netrunner **is the CyberBase game**: a browser 3D action / extraction RPG
(Next.js + React UI, Three.js scenes, Base wallet via wagmi). Routes: `/` Runner's
Refuge (Base), `/expedition` Outlands, `/metro` (frozen prototype),
`/editor/vegetation` (dev tool), `/ui-kit-preview`.

Before changing code read, in order: this file, `PROJECT_STATE.md`,
`ARCHITECTURE.md`, `CODEMAP.md`, `DECISIONS.md`, the latest `AI_HANDOFF.md`, and the
feature notes in `docs/` for the area you touch.

## Owner rules for the architecture refactor (do not violate)

- **Do not create a replacement game or project**, a parallel skeleton, or a new
  top-level app. The separate `D:\V2 Cyber\CyberBase` folder was a mistake and is paused.
- Refactor **in place, incrementally**. Preserve the current maps, 3D models,
  materials, textures, lighting, character, camera, controls, mobile controls, UI,
  interactions, Base, Expedition and every working mechanic. Do not rebuild
  something that works; wrap it, then move it.
- Three.js becomes the renderer layer; do not add gameplay state to Object3D.
  Where gameplay depends on Three.js today, add an adapter and move logic out step by step.
- No big ECS rewrite; component/system structure only where it clearly simplifies.
- The current maps stay the source of truth; move them to data only with verified visual parity.
- Editors are dev tools and must stay out of the production gameplay graph.

## Refactor checklist (after every change)

1. `npm test`, `npm run lint`, `npx tsc --noEmit` pass (run `npm run build` for larger steps).
2. The game starts (`npm run dev`, then `/` and `/expedition`) with no console errors.
3. The map looks the same (compare screenshots at spawn).
4. Player movement works (WASD, Shift, tap-to-move / map destinations).
5. The camera follows the player.
6. Mobile controls work (stick + portrait/landscape layout).
7. Interactions work (E / Talk to NPC dialog in Base; E prompt, extraction in Expedition).

Browser checks need a **visible** page. When the Claude app's Browser pane (or any
tab) is hidden, `document.hidden` is true and `requestAnimationFrame` never fires, so
the game renders nothing and the player cannot move — that is the shared frame loop's
intended `stop` behaviour, not a regression. Check `document.hidden` first.
A visible but unfocused pane (or a GPU shared with other heavy apps) can also drop to a few
frames per second; count `requestAnimationFrame` calls over 2 s before judging distances, and
if the rate is low compare against `HEAD` (`git stash -u`, same script, then `git stash pop`).

If any item breaks, fix it before continuing. Each architecture step is one commit
on branch `refactor/engine-architecture`; no push or merge without the owner.
Finishing a step also means updating `PROJECT_STATE.md`, `CODEMAP.md`,
`DECISIONS.md` (when a decision was made), `ARCHITECTURE.md` (when boundaries change)
and overwriting `AI_HANDOFF.md`.

## Structure

- `app/` — Next.js routes only.
- `components/` — current game code by feature (`base`, `expedition`, `game`,
  `metro3d`, `world-editor`, `vegetation`, `editor`), being migrated.
- `src/` — new engine layers (`assets`, `renderer`, later `core`, `input`,
  `world`, `gameplay`, `ui`, `shared`). Boundaries are enforced by `eslint.config.mjs`
  and `tests/engine-architecture.test.mjs` (see `ARCHITECTURE.md` §4).
- `public/` — runtime assets; register URLs in `src/assets/registry.ts`.
- `tests/` — `node:test` suites run by `npm test`.

## Commands

| Command | What |
|---|---|
| `npm ci` | Install |
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm test` | `node:test` suites (Node type stripping, no bundler) |
| `npm run lint` | ESLint (Next rules + src boundaries) |
| `npx tsc --noEmit` | Typecheck |
| `npm run build` | Production build |

## Coding conventions

- Code in `src/`: TypeScript, readable multi-line formatting, relative imports with
  explicit `.ts` extensions (so tests can import it through Node).
- Some tests assert exact source lines in scene/UI files (e.g.
  `editor.stream(editor.active?pivot:player.position)`, `createLazyEditor(()=>import(`).
  Keep them intact or update the test deliberately in the same commit.
- `netrunner:*` window events are the current UI ↔ engine bridge; do not add new
  ones — they will be replaced by a typed event bus.
- Never commit `.env*` or `.vercel/`; never push or deploy without the owner.
