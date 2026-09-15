# CyberBase UI kits

Three design kits delivered by the owner (2026-09-14) as zips:
`CyberBase_Hub_UI_Kit.zip`, `CyberBase_Ingame_HUD_Kit.zip`, `CyberBase_Dialogue_UI_Kit.zip`.
The zips are **not** stored in the repository (≈ 66 MB, mostly duplicated PNGs).
Only what the game needs is imported, compressed, by `scripts/import-ui-kits.mjs`.

## What each kit is for

| Kit | Purpose | Where it lives in the game |
|---|---|---|
| Hub | Meta screen before play: logo, profile, wallet, navigation, PLAY (the only way into the game), Season / SkyNet / NFT cards | `/` → `src/ui/hub/HubApp.tsx` (Base moved to `/base`) |
| In-game HUD | Player panel (avatar, HP, EN), objective, location header, minimap, interaction prompt, skill slots, run / backpack / map / menu buttons, joystick, attack button | Base `/base` and Expedition `/expedition` HUD (`components/game/GameHud.tsx`, `BaseApp.tsx`, `Expedition.tsx`, `MovementStick.tsx`) |
| Dialogue | NPC conversation window: portrait frame, name / role bar, text panel, 1–3 dynamic responses | NPC dialogs in `components/base/BaseApp.tsx` |

Every kit has three layouts: **desktop**, **mobile landscape**, **mobile portrait**.

## Kit rules we follow

- References are design guides only; never used as a UI layer.
- Backgrounds and the character are separate, replaceable layers.
- Text, numbers and names are rendered by React, never baked into images.
- Frames, panels and buttons are rebuilt in CSS (chamfered navy panels, cyan lines,
  yellow primary action). The kit PNGs for HUD and Dialogue are flat placeholders with
  baked text, so no HUD/Dialogue image ships.
- Response buttons in dialogs are created from data (only as many as exist).
- Breakpoints: desktop ≥ 1024 px (and ≥ 700 px tall), mobile landscape ≥ 700 px wide in
  landscape, mobile portrait otherwise.

## What was imported and how much space it takes

| Output | Source | Size |
|---|---|---|
| `public/ui/hub/character.webp` | `character.png` (trimmed) | 2.1 MB → 139 KB |
| `public/ui/hub/feature-{season,skynet,nft}.webp` | owner card backgrounds without frames / text (HUBB set), 1280 px, WebP q90 | 6.7 MB → 409 KB |
| `public/ui/hub/title-{season,skynet,nft}.webp` | owner title artwork (title + subtitle + accent line), 640 px, WebP q92 | 262 KB |
| `public/ui/hub/badge-{season,skynet,nft}.webp` | owner "coming soon" badges, 480 px, WebP q92 | 51 KB |
| `public/ui/hub/backdrop-{desktop,landscape,portrait}.webp` | owner backgrounds (not from the kits, see below), full resolution, WebP q92 | 6.6 MB → ≈ 880 KB (one loads per device) |
| `public/ui/hub/avatar-runner.webp` | portrait from `profile_panel.png` | 706 KB → 7 KB |
| `docs/ui-kits/references/*.webp` | 9 reference screens, 900 px wide | 11.9 MB → 383 KB |
| `docs/ui-kits/layouts/*.json` | 9 `layout.json` grids | copied |

Runtime total: **≈ 1.2 MB** of UI images, of which a device downloads **≈ 0.6 MB** (one backdrop);
the kit zips were ≈ 66 MB. The hub has no Base / Metro cards:
the player flow is wallet → hub → PLAY → base → expedition or metro (ADR-015), so the metro card
artwork is not imported.
Not imported: duplicate copies of the same PNGs per variant, hub icons (replaced by SVG in
`src/ui/hub/HubIcon.tsx`), menu / profile / wallet / play PNGs with baked text, HUD and
Dialogue placeholder PNGs.

Runtime URLs are registered in `src/assets/registry.ts` (`ASSET_URLS.ui`);
`tests/engine-architecture.test.mjs` and `tests/hub.test.mjs` check the files exist and that
no reference image is shipped from `public/`.

## Hub feature cards (ADR-018)

Season 1 / SkyNet / NFT Collection follow the owner's reference (`HUBB/референс.png`):
background art, a thin frame in the card tone (CSS), "CYBERBASE" with an accent line, the owner's
textured title artwork, a three- or four-line tagline, the owner's "coming soon" badge, a small text
top right and coordinates bottom right (React text from `src/ui/hub/hub-content.ts`).
Title and badge artwork carry `role="img"` labels with the same text. Everything inside a card is
sized in container units, so desktop, portrait and landscape cards keep the same composition;
small landscape cards show only the title and badge.

The framed card images of the HUBB set are not used: their neon frames are baked in, which would
force a fixed card shape. Re-import with:

```bash
node scripts/import-hub-cards.mjs "<HUBB folder>" --sheet contact-sheet.png
```

Images are cached for 30 days (`next.config.ts`); when artwork changes, give the file a new name.

## Hub backdrops (ADR-017)

Three owner backgrounds, one per layout: desktop (1672 × 941), mobile landscape (1672 × 941) and
mobile portrait (941 × 1672). They are compressed at full resolution with WebP quality 92, which is
visually lossless (checked side by side at 2× zoom); strictly lossless WebP was ≈ 1.6 MB per image.
To replace one, overwrite the file with the same settings:

```bash
node -e "require('sharp')('new.png').webp({quality:92,effort:6,smartSubsample:true}).toFile('public/ui/hub/backdrop-desktop.webp')"
```

## Re-importing after a kit update

```bash
# unzip the three kits into one folder, then:
node scripts/import-ui-kits.mjs <folder-with-unzipped-kits> --sheet contact-sheet.png
```

Check `contact-sheet.png` for baked text at the crop edges and adjust the `crop`
rectangles in the script. The script needs `sharp` (installed with Next.js).

## CyberBase 2D kit in the game world (test, branch `feature/ui-kit-3d`)

Owner request (2026-09-15): test the UI kit of the CyberBase 2D game — palette, style, dialogues,
talent matrix, inventory — inside the 3D game on `/base`. The hub is not touched. Not merged into
`main`; the owner decides after playing it. Standalone design reference with every screen and the
open questions: `D:\V2 Cyber\UI-Kit-3D-Proposal` (outside the repository).

| What | Where | Notes |
|---|---|---|
| Kit tokens and primitives | `src/ui/kit/kit.module.css` | Violet neutrals, amber = interactive, zone colours per station; scoped to `.kit` |
| NPC dialogue | `src/ui/dialogue/NpcDialogue.tsx`, rendered by `components/base/BaseApp.tsx` | Docked to the bottom; keys 1–9 choose, 0 leaves; wallet and settings dialogs keep the previous look |
| Loadout + ability matrix | `src/ui/character/*`, adapter `components/game/CharacterPanel.tsx`, opened by `GameHud.tsx` | Same panel on base and expedition (I, menu, Oracle, Locker) |
| Talent modules | `src/ui/character/talent-upgrades.ts` | Proposed names and percentages; combat does not read them |

Rules kept from the 2D kit: one amber fill per screen, colour carries meaning, one chamfer, locked
content stays visible with its reason, numbers are mono. Adapted for 3D: the dialogue never hides
the world, no levels (a module opens at rank 3 of the one above, 8 points), free class switch when
cooldowns are ready, four rarity tiers.

Checked 2026-09-15: `npm test` 115/115, lint, tsc. In the browser on `/base` (desktop 1024×768,
phone 375×812 and 844×390, DOM checks — the pane was hidden, so no 3D screenshot): dialogue keys
0 / 1 / Esc, quest checklist, loadout equip, matrix invest and locked reasons, Esc closes; no
clipped text, panels inside the viewport, no console or server errors. Still to see with eyes: the
look over the live 3D scene.
