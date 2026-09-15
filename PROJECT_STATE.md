# Project state — Netrunner / CyberBase

Last updated: 2026-09-15 · repository `mainetethereum-creator/NetrunnerV2`, branch `main` · architecture refactor steps 1–3, UI kits (hub, HUD, dialogue), development tools hidden from production.

## Implemented (the working game — must be preserved)

- **Hub `/`:** landing page from the CyberBase Hub UI kit (`src/ui/hub`): per-layout owner backdrops (desktop / landscape / portrait, ADR-017) and character layer, profile, wallet menu, navigation (side list / portrait tab bar), PLAY → `/base` (the only way into the game; expedition and metro start from the base, ADR-015), Season / SkyNet / NFT cards in the owner's HUBB design (background art, tone frame, title artwork, tagline, coming-soon badge, coordinates; ADR-018); desktop, mobile landscape and mobile portrait layouts.
- **UI kits:** in-game HUD kit skin on Base and Expedition (player panel with runner avatar, HP/EN, objective, location header, minimap, interaction prompt, skills, menu, stick) and Dialogue kit layout for NPC dialogs; artwork imported by `scripts/import-ui-kits.mjs` (see `docs/ui-kits/README.md`).
- **Base `/base` — Runner's Refuge:** procedural refuge (courtyard, zones, metro pit, perimeter fence, service street) + GLB buildings (workshop, oracle ×3 placements, city gate); PBR concrete/metal/stone, rain, wet-floor reflections (High), adaptive quality; NPC stations with dialogues (Cybersmith, Cryptomancer, Oracle, Green Exchange, Keeper, City airlock, locker, Quantum Charge, Outlands breach); orientation quest (localStorage); Base wallet connect; settings (rain, quality, perf stats, reset camera); minimap destinations with pathfinding; MASTER map editor for NPCs/props.
- **Expedition `/expedition` — Outlands:** 144 × 72 m world in 24 m chunks; terrain, asphalt highway, hangars, cyber buildings, props, fences, microbus, fires, baked vegetation, grass; POIs, loot tables, events, extraction (4 s), death loss, local stash; enemies implemented but disabled (`EXPEDITION_ENEMIES_ENABLED=false`); MASTER props / trees / landscape editors; debug panel (`?debug=1`).
- **Metro `/metro`:** frozen environment prototype.
- **Character & combat:** Neon Sentinel GLB (Draco), in-place run, procedural idle pose, class combat (Warrior / Mage / Ranger, skills 1–4, energy, cooldowns), retargeted ranger shot, great sword; HUD vitals/skills/menu; character, inventory and talents panel.
- **Controls:** WASD / arrows, Shift run, E interact, Space fire (expedition), 1–4 skills, I inventory, H hide HUD; tap / click to move; mobile stick with dead zone; touch profile with adaptive DPR and 30 fps fallback.
- **Tools (development only, ADR-019):** vegetation editor `/editor/vegetation`, UI kit preview `/ui-kit-preview`, MASTER map editor, expedition debug panel and test teleports. Production builds contain none of them.

## Architecture refactor progress

| Step | Status |
|---|---|
| 0 · Baseline (branch, snapshot commit, checks, screenshots) | done |
| 1 · Asset registry + shared glTF loader/disposal + boundary rules + docs | done |
| 2 · `src/core/loop`: one frame loop for all scenes with `fixedUpdate → update → render` | done |
| 3 · `src/input`: keyboard + stick → camera-relative move vector | done |
| 4 · camera rig | next |
| 5–12 · hero animation, player state, events, renderer bootstrap, map data, dev map editor, UI modules, ECS-style systems | planned (`ARCHITECTURE.md` §5) |

## Verification

**Step 1:** 82/82 tests, lint, tsc, `next build`; `/`, `/expedition`, `/metro` identical to baseline screenshots, movement, camera, NPC dialog, extraction prompt, mobile stick.

**Step 2:**
- `npm test` 88/88 (new `frame-loop.test.mjs` proves frame timing equals the legacy scene loops on identical timestamps, incl. the mobile cadence cap; architecture test asserts scenes no longer call requestAnimationFrame), lint clean, tsc clean, `npm run build` succeeds (all routes).
- Browser, desktop: `/`, `/expedition`, `/metro` load with no console errors and look identical. Movement over the same key hold lands on the same minimap position as in step 1 (Base W: 71.76, 76.65 vs 71.71, 76.58; Expedition D: 14.33, 33.65 vs 14.33, 33.65), so simulation speed is unchanged. requestAnimationFrame calls per 2 s before/after a `visibilitychange` event: Base 329/331, Expedition 331/331 — no duplicate loop after resume. Cybersmith route, "Talk to" dialog and Esc work; E at the breach starts extraction.
- Mobile emulation 375×812 (touch, cadence cap active): Base and Expedition load with the stick and touch HUD; stick drag moves the player exactly as in step 1; no errors.

**Step 3:**
- `npm test` 93/93 (new `input.test.mjs` proves the resolved direction is bit-identical to the legacy scene formula for every key combination × stick values × dead zones × editor bindings; architecture test asserts all scenes resolve movement through `src/input`), lint clean, tsc clean, `npm run build` succeeds.
- Browser A/B on the same machine state: the Browser pane was throttled to 2–5 frames per 2 s (unfocused pane, GPU shared with other running apps), so absolute distances are not comparable with step 2. The same scripted key holds were run on step 3 and on step 2 (`git stash`): Base W → (79.65643629339714, 90.88132104136145) and Expedition D → (9.177398984555857, 35.90764416489171) in **both** — bit-identical. E at the breach starts extraction; no console errors.
- Not re-run in this step because of the throttled pane: Cybersmith route → dialog (needs ~15 s of real frames) and mobile stick drag. The stick code path changed only by moving `stickVector` (re-exported, unit-tested). Re-check both in the next browser session.

**UI kits (hub, HUD, dialogue):**
- `npm test` 97/97 (new `hub.test.mjs`), lint clean, tsc clean, `npm run build` succeeds (routes `/`, `/base`, `/expedition`, `/metro`, …).
- Assets: the three zips (≈ 66 MB) → runtime artwork `public/ui` ≈ 1.8 MB (three hub backdrops ≈ 880 KB, of which one loads per device; card art, titles and badges ≈ 720 KB) (WebP, cropped to art without baked text) + references and layout grids in `docs/ui-kits` ≈ 450 KB.
- Browser: hub at 1536×864, 844×390 and 390×844 — layout grids match the kit (desktop: nav 250 px, card column 476 px; landscape fits without scrolling; portrait scrolls with a fixed tab bar); all hub artwork loads; no console errors. `/base` loads at the new route; settings contain "Return to hub"; expedition "Leave without loot" links to `/base`.
- HUD skin checked on `/base` and `/expedition` at 618×910 (screenshots) and on `/expedition` at 1536×864 (element geometry: no overlaps); positions of all controls are unchanged. NPC dialog (Cryptomancer via Missions / Contracts) renders portrait, name bar, text, a yellow primary reply and the back reply in the portrait layout; at 1536×864 it is docked at the bottom (1120 × 419 px) with the portrait column (270 px) left of name, text and replies; Esc closes it.

## Partially implemented

- Hub: Character, Inventory, Season, Events, Leaderboard, Marketplace and News are marked "Soon"; Season / SkyNet / NFT cards are static; the profile shows the local hero (Neon Sentinel, Lv. 1), not an account.
- HUD kit elements without game logic yet: mobile attack button (the game has no touch basic-attack input), minimap target pill ("last fuel station"), chat bar. NPC portraits are initials in the portrait frame (no NPC artwork exists).
- New layers: `src/assets/registry.ts`, `src/renderer/three/*`, `src/core/loop/frame-loop.ts`, `src/input/*`, `src/ui/hub/*`. Everything else still lives in `components/`.
- The loop's `fixedUpdate` phase exists and is tested but no scene uses it yet (needs render interpolation of gameplay state, step 6).
- Asset registry covers the Draco decoder, hero model and refuge buildings; other asset paths are still hardcoded.
- Expedition enemies are disabled; combat damage resolves at activation; level stays 1; talents are locked.
- Editors save only to browser localStorage.
- Metro is a frozen prototype.

## Planned

- **Wallet-first access (ADR-016, owner rule, not implemented):** no guest mode — connect wallet → hub → PLAY → base; Coinbase Wallet / Base Account, MetaMask, Rabby, OKX and other EVM wallets (EIP-6963 + WalletConnect); Base mainnet as the primary chain with a switch-to-Base prompt. Today guests can still enter the hub and the base.
See `ARCHITECTURE.md` §5 (steps 3–12) and `docs/` feature notes.

## Known issues

- Architecture problems listed in `ARCHITECTURE.md` §3 (monolithic scenes, duplicated input/camera/hero code, Object3D as source of truth, no fixed timestep in use, window event bus, map layout in code, module-level state).
- Dead asset references: `slash.glb`, `cast.glb` in `components/game/class-actions.ts` and `/game/weapons/sword/01-up.webp` in `components/game/sword-attack.ts` point to files that do not exist (not requested at runtime today). `public/base/models/outlaw-refuge.glb` is unused.
- Landscape phone layout could not be tested with touch in browser emulation (custom sizes ≥ 768 px wide get no touch emulation); real-device portrait/landscape and FPS still need a phone test.
- Real tab switching (document actually hidden) was simulated with a synthetic `visibilitychange` event in the browser and covered by unit tests; check once on a real device/browser.
- The browser network log accumulates across reloads; count requests per document (Resource Timing) when checking duplicate loads.
- The mistaken `D:\V2 Cyber\CyberBase` monorepo and the agent scratch folders `.dream-loop` / `.cache` were moved to the Recycle Bin on 2026-09-15.
- The Vercel project `netrunner-cyberbase` is deployed from this folder with the Vercel CLI and is not connected to GitHub yet; connect it to NetrunnerV2 in Vercel → Settings → Git (owner action).
- Pre-existing: on a narrow desktop window (< 650 px, mouse) the base MASTER toggle overlaps the HUD menu buttons.
- The Claude Browser pane cannot take screenshots while the Claude window is minimized; use element geometry (`getBoundingClientRect`) or bring the window forward.

## Next recommended task

Step 4: camera rig — extract the fixed-angle follow camera (azimuth, distance, smoothing, reset) shared by the three scenes into `src/renderer` / `src/gameplay` without behaviour change. In parallel (owner request): integrate the CyberBase Hub, in-game HUD and Dialogue UI kits.
