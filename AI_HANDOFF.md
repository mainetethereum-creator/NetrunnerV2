# AI handoff — 2026-09-14 · CyberBase UI kits (hub, in-game HUD, dialogue)

Author: Claude (Opus 5). Read `AGENTS.md` first. Branch: `refactor/engine-architecture`.
Owner request: integrate `CyberBase_Hub_UI_Kit`, `CyberBase_Ingame_HUD_Kit` and
`CyberBase_Dialogue_UI_Kit` (desktop + mobile variants) and keep them small in the repo.
Kit mapping, rules and sizes: `docs/ui-kits/README.md`. Decision: ADR-014.

## 1. What was done

- **Assets:** `scripts/import-ui-kits.mjs` crops kit artwork to regions without baked text,
  converts it to WebP (`public/ui/hub`, ≈ 440 KB instead of ≈ 66 MB of zips) and writes small
  references + layout grids to `docs/ui-kits`. URLs are in `src/assets/registry.ts` (`ASSET_URLS.ui`).
- **Hub** (`src/ui/hub`, route `/`): per-layout owner backdrops (ADR-017) and character layer, logo, profile, wallet menu
  (wagmi), navigation (side list on desktop / landscape, tab bar in portrait), PLAY → `/base`
  (the only link into the game: wallet → hub → PLAY → base → expedition or metro, ADR-015),
  cards Season, SkyNet, NFT ("coming soon"). Text is React,
  frames are CSS; three layouts by breakpoints.
- **Routes:** Runner's Refuge moved to `/base` (`app/base/page.tsx`); expedition, metro and the
  vegetation editor return to `/base`; base settings gained "Return to hub".
- **In-game HUD kit skin** (CSS appended at the end of `GameHud.module.css`,
  `Expedition.module.css`, `BaseApp.module.css`, `MovementStick.module.css`; tokens `--cb-*` in
  `app/globals.css`): chamfered navy panels with cyan corner lines, runner avatar and yellow level
  badge, green HP / blue EN with labels, cyan skill slots, round menu buttons, objective with
  yellow bar, location header, round minimap, interaction prompt, joystick ring with arrows.
  **Positions and sizes of HUD elements were not changed** (they are tuned for phones).
- **Dialogue kit:** NPC dialogs in `BaseApp.tsx` get a portrait frame (NPC initials), name / role
  bar, text panel and replies; the first actionable reply is yellow. Layouts: desktop (docked at the
  bottom, portrait left), mobile portrait (single column), mobile landscape (small portrait left).
- Tests: `tests/hub.test.mjs`; `engine-architecture.test.mjs` now also checks UI artwork exists.

## 2. Files

Created: `src/ui/hub/{HubApp.tsx,HubIcon.tsx,hub-content.ts,Hub.module.css}`, `app/base/page.tsx`,
`scripts/import-ui-kits.mjs`, `public/ui/hub/*.webp`, `docs/ui-kits/**`, `tests/hub.test.mjs`.
Changed: `app/page.tsx`, `app/globals.css`, `src/assets/registry.ts`, `components/game/GameHud.tsx`,
`components/game/GameHud.module.css`, `components/game/MovementStick.module.css`,
`components/base/BaseApp.tsx`, `components/base/BaseApp.module.css`,
`components/expedition/Expedition.tsx` (links), `components/expedition/Expedition.module.css`,
`components/metro3d/Metro3D.tsx` (links), `components/editor/VegetationEditor.tsx` (link),
`AGENTS.md`, `CODEMAP.md`, `DECISIONS.md` (ADR-014), `PROJECT_STATE.md`, this file.

## 3. Key decisions

- Kit PNGs for HUD and Dialogue are flat placeholders with baked text → rebuilt in CSS, no images shipped.
- Hub cards and character use real kit artwork, cropped so no baked text remains; the hub
  backdrops are separate owner images per layout, WebP q92 (`backdrop-{desktop,landscape,portrait}.webp`). Hub icons are inline SVG.
- The skin is additive CSS; removing the "UI kit skin" blocks restores the previous look.

## 4. Commands

```bash
cd "D:\V2 Cyber\Netrunner"
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run dev        # http://localhost:3000  (/, /base, /expedition, /metro)
node scripts/import-ui-kits.mjs <unzipped-kits-folder> --sheet contact-sheet.png   # re-import kits
```

Stop the dev server when finished.

## 5. Manual checks

1. `/` hub on desktop, phone portrait (tab bar) and phone landscape (fits one screen); PLAY opens `/base` and nothing in the hub links to metro or expedition; wallet menu opens and closes (Esc / click outside).
2. `/base`: HUD skin, "Talk to" prompt, Cybersmith dialog → portrait / name / text / replies; settings → Return to hub.
3. `/expedition`: HUD skin; E at the breach starts extraction; "Leave without loot" returns to `/base`.
4. Phone: stick ring works, dialog fits in portrait and landscape.

## 6. Known issues

See `PROJECT_STATE.md`. Headlines: hub menu items and Season / SkyNet / NFT are placeholders;
no mobile attack button or minimap target pill yet; NPC portraits are initials; pre-existing MASTER
toggle overlap on very narrow desktop windows; Browser pane screenshots fail while the Claude
window is minimized.

## 7. Next recommended step

Architecture step 4: camera rig (fixed-angle follow camera shared by the three scenes), no behaviour change.
UI follow-ups when the owner wants them: NPC portrait art, mobile attack button bound to the existing
basic attack, hub sections for character / inventory.
Product rule recorded but not implemented: wallet-first access (no guests), EVM wallets (Coinbase
Wallet / Base Account, MetaMask, Rabby, OKX, others), Base as the primary chain — ADR-016. Confirm
with the owner before implementing; open questions are listed in the ADR.

## 8. Do not rewrite without a strong reason

- HUD element positions and mobile media queries (tuned for phones); change looks only in the skin blocks.
- Kit rules: no baked text, separate backdrop / character layers, references never in `public/`.
- Earlier steps: frame loop timing, `src/input` arithmetic, source lines asserted by tests
  (`Boolean(state.near)||state.extraction>0`, "EXPEDITION OBJECTIVE", "LOCAL SIGNAL" in `Expedition.tsx`, …).
