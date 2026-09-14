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
| `public/ui/hub/card-{season,skynet,nft}.webp` | card PNGs, cropped to artwork without baked text / buttons | 4.2 MB → 164 KB |
| `public/ui/hub/backdrop.webp` | artwork of `base_card.png` (hub backdrop) | 1.6 MB → 115 KB |
| `public/ui/hub/avatar-runner.webp` | portrait from `profile_panel.png` | 706 KB → 7 KB |
| `docs/ui-kits/references/*.webp` | 9 reference screens, 900 px wide | 11.9 MB → 383 KB |
| `docs/ui-kits/layouts/*.json` | 9 `layout.json` grids | copied |

Runtime total: **≈ 440 KB** (was ≈ 66 MB in the zips). The hub has no Base / Metro cards:
the player flow is wallet → hub → PLAY → base → expedition or metro (ADR-015), so the metro card
artwork is not imported.
Not imported: duplicate copies of the same PNGs per variant, hub icons (replaced by SVG in
`src/ui/hub/HubIcon.tsx`), menu / profile / wallet / play PNGs with baked text, HUD and
Dialogue placeholder PNGs.

Runtime URLs are registered in `src/assets/registry.ts` (`ASSET_URLS.ui`);
`tests/engine-architecture.test.mjs` and `tests/hub.test.mjs` check the files exist and that
no reference image is shipped from `public/`.

## Re-importing after a kit update

```bash
# unzip the three kits into one folder, then:
node scripts/import-ui-kits.mjs <folder-with-unzipped-kits> --sheet contact-sheet.png
```

Check `contact-sheet.png` for baked text at the crop edges and adjust the `crop`
rectangles in the script. The script needs `sharp` (installed with Next.js).
