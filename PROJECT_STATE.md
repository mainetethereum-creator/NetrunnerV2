# Project state — Netrunner / CyberBase

Last updated: 2026-09-19 · repository `mainetethereum-creator/NetrunnerV2`; current working branch `feature/ui-kit-3d` · architecture refactor steps 1–4, UI kits and owner-requested Base environment rollback. Uncommitted hero extraction predates this atmosphere task; step 5 is not signed off.

## Implemented (the working game — must be preserved)

- **Relocated metro opening (2026-09-19):** revealed the existing stairs and 2.4 m lower landing beneath the owner's east-side entrance. Shared clipping planes cut stone, both structural layers and High-mode reflections; cut follows original metro transforms and closes on deletion. Four tread guide lights. Current **40-entry** owner map is preserved exactly in `output/map-backups/base-with-metro-opening-2026-09-19.json`; camera unchanged. Visual entrance only; door/navigation unchanged. See `docs/metro-opening.md` (ADR-038). Earlier map counts below are historical.

- **City frontage and traffic (2026-09-19):** the owner replaced the outskirts with a two-way street, sidewalks, low divider, bus stops and lamps. Instanced sedans, taxis and buses animate in the shared scene loop. Settings → City traffic persists and can override the reduced-motion default; enabled in the owner's browser. Latest map: **37 entries**, `output/map-backups/base-with-city-traffic-2026-09-19.json`. Only 20 outskirts scenery IDs removed; all owner edits/four new buildings/camera retained. Road is scenery outside walking bounds. See `docs/city-street.md` (ADR-037).

- **Four buildings and first outskirts (2026-09-19, scenery superseded above):** two corners and two slender modern towers modeled and placed in the owner's Base. Seven GLBs plus reused drums, fire, tires and bags remain in the catalogue. Historical 57-entry map: `output/map-backups/base-with-outskirts-2026-09-19.json`; all original 32 entries unchanged. See `docs/outskirts-kit.md`.

- **Latest owner map checkpoint (2026-09-19):** saved in browser and exported as `output/map-backups/base-checkpoint-2026-09-19.json` (28 entries). Includes owner-placed parts shop/CYBERBASE, relocated Coinbase/metro and second portrait tower. This supersedes all historical positions and 16-entry snapshots below; preserve newer browser edits.

- **CYBERBASE / parts / office trio (2026-09-19):** three approved concepts modeled in Blender and added to both MASTER catalogues. CYBERBASE tower: 6,726 triangles, 28 m; Japanese parts shop: 5,496 triangles, 10.7 m; modern office: 5,512 triangles, 11 m. Shared dark concrete, original window/sign artwork, static vertical CYBERBASE ticker. On-demand loading, no automatic map placement. See `docs/city-trio.md`.

- **Coinbase wallet tower (2026-09-18):** narrow approved glass tower modeled in Blender, 7,688 triangles / 10 draws / 2.96 MiB, 8.2 × 7.64 × 32.74 m. Exact concept artwork, shared dark concrete, separate wraparound hologram ticker; advertising remains static. Saved on Base at (7.3151, -3.67, -18.7692), scale 1, rotation 0. The complete 16-entry layout is backed up as `output/map-backups/base-with-wallet-tower-saved-2026-09-18.json`. See `docs/wallet-tower.md`.

- **Japanese café (2026-09-18):** approved food-café concept modeled in Blender, 8,334 triangles / 10 draws / 3.14 MiB. Shared dark concrete, original sign/menu artwork, counter, stools, lanterns, balcony and roof equipment. Both MASTER catalogues include it. Replaces the owner's current Base armory at their request; the other 15 saved entries and camera are preserved. Armory stays in the catalogue. See `docs/japanese-cafe.md`.

- **Approved glass corner (2026-09-18):** second Glass + Neon concept modeled in Blender: 9,064 triangles / 10 draws / 3.13 MiB; 14.9 × 11.427 × 21.135 m. Exact approved red/cyan advertising, shared dark concrete, roof hardware, cables and open-stroke energy-cell hologram. Both MASTER catalogues load it on demand. A copy is saved on the west Base lot at (−24, .08, 2), yaw 90°; all prior 15 entries and the saved camera are preserved. See `docs/glass-corner.md`.

- **Editor arrow-key performance (2026-09-18):** transforms/collider callbacks now touch only changed objects; unchanged footprints and static selection bounds are cached, duplicate MASTER activation is skipped, and Base editor shadow refresh is bounded. CPU fixture median 4.24 → 0.51 ms per edit (not an FPS claim); actual Base nudge/Undo preserves the complete 15-entry map. Full GLB/procedural inventory lives in `output/performance/`; see `docs/base-map-editor.md`.

- **Saved Base map restoration (2026-09-18):** the latest browser map loads before gameplay is shown, without opening MASTER. Editor toggles/Escape no longer cancel placed-model restoration; pending/failed loads cannot overwrite the save. Scene recreation synchronizes MASTER and its loading screen. Current 15-entry owner layout and saved camera preserved; see `docs/base-map-editor.md`.

- **Approved glass media tower (2026-09-18):** first Dreamatron-inspired concept implemented in Blender and installed on Base's rear east lot at (24, −27). The original portrait PNG is embedded byte-for-byte; projective UVs preserve the woman and pixel media style. 6,623 triangles / 9 draws / 3.07 MB. Dark shared concrete, roof equipment and cables; both MASTER catalogues include the tower, default Base collision follows edits. The second concept is now implemented too (see glass corner above). See `docs/media-tower.md`.

- **Base elevated transit V2 (2026-09-18):** short rear route begins behind the portrait tower, passes behind it and the Coinbase tower, then turns 35° on a 32 m radius toward metro. Deck12.6 m (lowered a further 60 cm); 8 spans/4 supports. Three independently turning coaches at7 m/s retain bellows, headlights, guideway lighting, cables and utility details. The current 16-entry map is preserved and `Standard 2` remains the gameplay follow camera. See `docs/base-elevated-rail.md`.

- **Open city construction pad (2026-09-18):** Base paving/foundation is now one continuous 64 × 54 m rectangle (x −32…32, z −42…12), including the former metro opening and the east-side void. Navigation and the minimap use the same bounds. Only the owner's marked front concrete fence remains; west/east/north perimeter runs and their rubble were removed. The moved metro remains an editable saved object. ADR-032.

- **Base framing follow-up (2026-09-18):** owner's current camera frame locked and saved in this browser; Base hero and fallback visuals enlarged by 25% without changing movement/collisions.

- **Shared camera framing (2026-09-18):** Base manual orbit/pan/zoom and «Зафиксировать кадр» persist angle, distance and composition relative to the hero. Base free framing also provides visible `− / +` zoom controls for systems where the wheel is unavailable, using the same 4–100 m limits. Base and Expedition smoothly follow with this same framing; original world-space saves migrate automatically. «Стандартный ракурс» restores Tactical. Runner input is suppressed while framing and follows the selected view's axes when locked. See `docs/base-camera.md` (ADR-030).

- **Base north extension (2026-09-18):** superseded by the open city construction pad in ADR-032. The saved editor layout remains preserved in browser storage and JSON backup. Shared dimensions live in `components/base/layout.ts`; see `docs/base-map-editor.md`.

- **Concrete matching follow-up (2026-09-18):** imported V1 buildings now use the exact shared legacy concrete shader and original atlas, with metre-based UVs, bump and joints. New models are one tone darker (0.75 linear tint); original houses keep their appearance. Standalone Blender exports retain a baked fallback.

- **Reference buildings V1 (2026-09-18):** Blender armory, Chinese restaurant and central administration are available in Expedition and Base MASTER catalogues. Standalone textured GLBs are 6.3–10.4k triangles, 7–8 material draws; load only on selection/placement. Concrete uses the narrow balcony house / SECTOR 02 atlas source. Administration reduced to 13.26 × 8.04 × 13.2 m for Base. See `docs/reference-buildings.md`; final visual review is owner-led.

- **Base MASTER scenery editing (2026-09-18, ADR-028):** select, delete, transform and place authored scenery, including buildings/IMPLANTS, six perimeter wall sections, floor, lamps, planters and small props. Pristine templates remain in the catalogue after originals are deleted. Undo/redo and browser save/JSON use the existing editor document. Authored collision overrides follow edits; decorative floor copies do not block walking. Composite objects edit as a whole; hero, weather, station triggers and logical map limits stay protected. Editor code remains lazy/dev-only; gameplay re-batches compatible instances. See `docs/base-map-editor.md`.

- **Tactical only + physical WASD (2026-09-18, ADR-026):** owner selected the original Tactical camera after comparing alternatives. City framing, third-person and ARPG implementations, mode switch/V shortcut and distance settings removed. Shared Tactical rig/preset stays unchanged. Base WASD uses physical keys (including Russian ЦФЫВ) and resumes from focused HUD buttons without a ground click; modals/text entry still block movement. No added scene assets or render passes.

- **Base environment rollback (2026-09-18, ADR-027):** restored the original courtyard, west perimeter, walking bounds, stations, minimap and rain settings. Removed the added city backdrop, apartments, viaduct/train, market streets, armory, food stalls, lanterns and city audio. Only the owner-marked green IMPLANTS building remains, at its original (-20.5, -8) placement outside the west wall, as scenery. Standalone 1.03 MB GLB retains original materials and 6,972 triangles. Tactical and physical WASD remain. See `docs/base-night-market.md`.

- **Hub `/`:** landing page from the CyberBase Hub UI kit (`src/ui/hub`): per-layout owner backdrops (desktop / landscape / portrait, ADR-017) and character layer, profile, wallet menu, navigation (side list / portrait tab bar), PLAY → `/base` (the only way into the game; expedition and metro start from the base, ADR-015), Season / SkyNet / NFT cards in the owner's HUBB design (background art, tone frame, title artwork, tagline, coming-soon badge, coordinates; ADR-018); desktop, mobile landscape and mobile portrait layouts.
- **UI kits:** in-game HUD kit skin on Base and Expedition (player panel with runner avatar, HP/EN, objective, location header, minimap, interaction prompt, skills, menu, stick) and Dialogue kit layout for NPC dialogs; artwork imported by `scripts/import-ui-kits.mjs` (see `docs/ui-kits/README.md`).
- **Loading screen (ADR-021):** base and expedition load behind the owner's pixel helmet: darkness, light sweep, red eyes that breathe and blink, real percent and file names from the three.js loading manager, then the screen dissolves into the scene.
- **Base `/base` — Runner's Refuge:** procedural refuge (continuous city construction pad, zones, movable metro entrance, retained front fence, service street) + GLB buildings (workshop, oracle ×3 placements, city gate); PBR concrete/metal/stone, rain, wet-floor reflections (High), adaptive quality; NPC stations with dialogues (Cybersmith, Cryptomancer, Oracle, Green Exchange, Keeper, City airlock, locker, Quantum Charge, Outlands breach); orientation quest (localStorage); Base wallet connect; settings (rain, quality, perf stats, reset camera); minimap destinations with pathfinding; MASTER map editor for NPCs/props.
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
| 4 · `src/renderer/camera`: one follow camera for all scenes | done |
| 5 · hero model and animation | next |
| 6–12 · player state, events, renderer bootstrap, map data, dev map editor, UI modules, ECS-style systems | planned (`ROADMAP.md`) |

## Verification

**Glass media tower (2026-09-18):** 156 tests, lint, TypeScript and production build passed. Final asset revision passed the 11 media/reference tests. Browser confirmed default placement, final catalogue geometry, preserved prior map layout and no errors; portrait identity verified against embedded source bytes. Physical-phone performance not measured.

**Environment rollback (2026-09-18):** 121/121 tests, lint, TypeScript and production build pass. Original camera parity and legacy station path checks pass; former west district destinations are rejected. Physical phone testing remains owed.

**Base night district (2026-09-17):** 128/128 tests, lint, TypeScript and production build pass.
Visible browser verified district traversal from spawn, Armory E interaction → existing Inventory,
rain/audio/train switches, portrait 390×844 and landscape 844×390 layouts, and original Hub / Expedition
loading without console errors. Expedition extraction at the breach completed successfully. Physical
touch input, sustained phone performance and subjective audio balance still require device checks.

**Step 1:** 82/82 tests, lint, tsc, `next build`; `/`, `/expedition`, `/metro` identical to baseline screenshots, movement, camera, NPC dialog, extraction prompt, mobile stick.

**Step 2:**
- `npm test` 88/88 (new `frame-loop.test.mjs` proves frame timing equals the legacy scene loops on identical timestamps, incl. the mobile cadence cap; architecture test asserts scenes no longer call requestAnimationFrame), lint clean, tsc clean, `npm run build` succeeds (all routes).
- Browser, desktop: `/`, `/expedition`, `/metro` load with no console errors and look identical. Movement over the same key hold lands on the same minimap position as in step 1 (Base W: 71.76, 76.65 vs 71.71, 76.58; Expedition D: 14.33, 33.65 vs 14.33, 33.65), so simulation speed is unchanged. requestAnimationFrame calls per 2 s before/after a `visibilitychange` event: Base 329/331, Expedition 331/331 — no duplicate loop after resume. Cybersmith route, "Talk to" dialog and Esc work; E at the breach starts extraction.
- Mobile emulation 375×812 (touch, cadence cap active): Base and Expedition load with the stick and touch HUD; stick drag moves the player exactly as in step 1; no errors.

**Step 3:**
- `npm test` 93/93 (new `input.test.mjs` proves the resolved direction is bit-identical to the legacy scene formula for every key combination × stick values × dead zones × editor bindings; architecture test asserts all scenes resolve movement through `src/input`), lint clean, tsc clean, `npm run build` succeeds.
- Browser A/B on the same machine state: the Browser pane was throttled to 2–5 frames per 2 s (unfocused pane, GPU shared with other running apps), so absolute distances are not comparable with step 2. The same scripted key holds were run on step 3 and on step 2 (`git stash`): Base W → (79.65643629339714, 90.88132104136145) and Expedition D → (9.177398984555857, 35.90764416489171) in **both** — bit-identical. E at the breach starts extraction; no console errors.
- Not re-run in this step because of the throttled pane: Cybersmith route → dialog (needs ~15 s of real frames) and mobile stick drag. The stick code path changed only by moving `stickVector` (re-exported, unit-tested). Re-check both in the next browser session.

**Step 4:**
- `npm test` 110/110. New `camera.test.mjs` replays 6 000 random frames per scene (dt incl. 0 and the 0.05 clamp, teleports, reduced motion, aspects around the 0.85 portrait threshold, MASTER zoom, expedition pan and tree editor moves, base "Reset camera") and compares pivot and camera position with `Object.is` against the legacy three.js `Vector3` code — bit-identical for base, expedition and metro. The architecture test asserts every scene places the camera through the rig. Lint clean, tsc clean.
- Browser: the dev server compiled `/base` and the page loaded (canvas present, no server or console errors), but the Browser pane was hidden (`document.hidden`, 0×0 viewport), so no frames ran. Spawn screenshots, walking camera, Reset camera, MASTER zoom / pan and mobile portrait distance were not checked in a browser — listed as TD-02 in `ROADMAP.md`. `npm run build` not run (no bootstrap or config change).

**UI kits (hub, HUD, dialogue):**
- `npm test` 97/97 (new `hub.test.mjs`), lint clean, tsc clean, `npm run build` succeeds (routes `/`, `/base`, `/expedition`, `/metro`, …).
- Assets: the three zips (≈ 66 MB) → runtime artwork `public/ui` ≈ 1.8 MB (three hub backdrops ≈ 880 KB, of which one loads per device; card art, titles and badges ≈ 720 KB) (WebP, cropped to art without baked text) + references and layout grids in `docs/ui-kits` ≈ 450 KB.
- Browser: hub at 1536×864, 844×390 and 390×844 — layout grids match the kit (desktop: nav 250 px, card column 476 px; landscape fits without scrolling; portrait scrolls with a fixed tab bar); all hub artwork loads; no console errors. `/base` loads at the new route; settings contain "Return to hub"; expedition "Leave without loot" links to `/base`.
- HUD skin checked on `/base` and `/expedition` at 618×910 (screenshots) and on `/expedition` at 1536×864 (element geometry: no overlaps); positions of all controls are unchanged. NPC dialog (Cryptomancer via Missions / Contracts) renders portrait, name bar, text, a yellow primary reply and the back reply in the portrait layout; at 1536×864 it is docked at the bottom (1120 × 419 px) with the portrait column (270 px) left of name, text and replies; Esc closes it.

## Partially implemented

- Hub: Character, Inventory, Season, Events, Leaderboard, Marketplace and News are marked "Soon"; Season / SkyNet / NFT cards are static; the profile shows the local hero (Neon Sentinel, Lv. 1), not an account.
- HUD kit elements without game logic yet: mobile attack button (the game has no touch basic-attack input), minimap target pill ("last fuel station"), chat bar. NPC portraits are initials in the portrait frame (no NPC artwork exists).
- New layers: `src/assets/registry.ts`, `src/renderer/three/*`, `src/core/loop/frame-loop.ts`, `src/input/*`, `src/renderer/camera/*`, `src/ui/hub/*`, `src/ui/loading/*`. Everything else still lives in `components/`.
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
- The Vercel project `netrunner-cyberbase` is connected to NetrunnerV2 (2026-09-15): every push to `main` deploys https://netrunner-cyberbase.vercel.app.
- Pre-existing: on a narrow desktop window (< 650 px, mouse) the base MASTER toggle overlaps the HUD menu buttons.
- The Claude Browser pane cannot take screenshots while the Claude window is minimized; use element geometry (`getBoundingClientRect`) or bring the window forward.

## Next recommended task

When the owner asks to resume the architecture refactor, follow `ROADMAP.md`.
First `next` item: step 5, hero model and animation in `src/renderer/animations/hero`,
no behaviour change; run the owed browser checks (TD-02) before or alongside it.
Feature and asset requests remain their own tasks and do not start this queue.

Production Base now includes the owner-approved 40-entry city layout independently
of local editor saves. Release hydration preserves moved/deleted buildings, stations,
colliders and metro opening. See `docs/base-map-editor.md`.
