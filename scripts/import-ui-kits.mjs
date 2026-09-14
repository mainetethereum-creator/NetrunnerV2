// Imports the CyberBase UI kits (Hub, in-game HUD, Dialogue) into the game.
//
// Usage:
//   node scripts/import-ui-kits.mjs <extracted-kits-dir> [--sheet <file.png>]
//
// <extracted-kits-dir> contains the unzipped kits:
//   CyberBase_Hub_UI_Kit/, CyberBase_Ingame_HUD_Kit/, CyberBase_Dialogue_UI_Kit/
//
// What ships (see docs/ui-kits/README.md):
// - public/ui/hub/*.webp: artwork only. Baked text, buttons and frames are cropped away
//   because text is rendered by React and frames are CSS.
// - docs/ui-kits/references/*.webp: small design references (never loaded by the game).
// - docs/ui-kits/layouts/*.json: the kits' layout grids.
// The HUD and Dialogue kits ship no runtime images: their frames are rebuilt in CSS.
//
// Requires `sharp` (installed with Next.js; `npm i -D sharp` if it is missing).
import sharp from 'sharp';
import {copyFileSync, existsSync, mkdirSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HUB = 'CyberBase_Hub_UI_Kit/CyberBase_Hub_UI_Kit';
const HUD = 'CyberBase_Ingame_HUD_Kit/CyberBase_Ingame_HUD_Kit';
const DIALOGUE = 'CyberBase_Dialogue_UI_Kit/CyberBase_Dialogue_UI_Kit';

// crop: [left, top, width, height] in source pixels.
const ART = [
  {out: 'public/ui/hub/character.webp', src: `${HUB}/shared/png/character.png`, trim: true, width: 860, quality: 78},
  {out: 'public/ui/hub/card-season.webp', src: `${HUB}/shared/png/season_card.png`, crop: [720, 240, 740, 462], width: 640},
  {out: 'public/ui/hub/card-skynet.webp', src: `${HUB}/shared/png/skynet_card.png`, crop: [810, 200, 630, 530], width: 600},
  {out: 'public/ui/hub/card-nft.webp', src: `${HUB}/shared/png/nft_card.png`, crop: [840, 234, 640, 464], width: 600},
  {out: 'public/ui/hub/backdrop.webp', src: `${HUB}/shared/png/base_card.png`, crop: [112, 294, 1226, 440], width: 1226, quality: 72},
  {out: 'public/ui/hub/avatar-runner.webp', src: `${HUB}/shared/png/profile_panel.png`, crop: [378, 226, 244, 272], width: 160, quality: 82},
];

const REFERENCES = [
  [`${HUB}/site/reference_site.png`, 'hub-desktop.webp'],
  [`${HUB}/mobile_landscape/reference_mobile_landscape.png`, 'hub-mobile-landscape.webp'],
  [`${HUB}/mobile_portrait/reference_mobile_portrait.png`, 'hub-mobile-portrait.webp'],
  [`${HUD}/shared/references/desktop.png`, 'hud-desktop.webp'],
  [`${HUD}/shared/references/mobile_landscape.png`, 'hud-mobile-landscape.webp'],
  [`${HUD}/shared/references/mobile_portrait.png`, 'hud-mobile-portrait.webp'],
  [`${DIALOGUE}/shared/references/desktop.png`, 'dialogue-desktop.webp'],
  [`${DIALOGUE}/shared/references/mobile_landscape.png`, 'dialogue-mobile-landscape.webp'],
  [`${DIALOGUE}/shared/references/mobile_portrait.png`, 'dialogue-mobile-portrait.webp'],
];

const LAYOUTS = [
  [`${HUB}/site/layout.json`, 'hub-desktop.json'],
  [`${HUB}/mobile_landscape/layout.json`, 'hub-mobile-landscape.json'],
  [`${HUB}/mobile_portrait/layout.json`, 'hub-mobile-portrait.json'],
  [`${HUD}/desktop/layout.json`, 'hud-desktop.json'],
  [`${HUD}/mobile_landscape/layout.json`, 'hud-mobile-landscape.json'],
  [`${HUD}/mobile_portrait/layout.json`, 'hud-mobile-portrait.json'],
  [`${DIALOGUE}/desktop/layout.json`, 'dialogue-desktop.json'],
  [`${DIALOGUE}/mobile_landscape/layout.json`, 'dialogue-mobile-landscape.json'],
  [`${DIALOGUE}/mobile_portrait/layout.json`, 'dialogue-mobile-portrait.json'],
];

function ensureDir(file) {
  mkdirSync(dirname(file), {recursive: true});
}

async function writeArt(kits, item) {
  const source = join(kits, item.src);
  let image = sharp(source);
  if (item.crop) {
    const [left, top, width, height] = item.crop;
    image = image.extract({left, top, width, height});
  }
  if (item.trim) image = sharp(await image.trim({threshold: 4}).toBuffer());
  const buffer = await image
    .resize({width: item.width, withoutEnlargement: true})
    .webp({quality: item.quality ?? 76, alphaQuality: 85, effort: 6})
    .toBuffer();
  const target = join(ROOT, item.out);
  ensureDir(target);
  writeFileSync(target, buffer);
  return {source: statSync(source).size, output: buffer.length, target: item.out};
}

async function writeReference(kits, [src, name]) {
  const source = join(kits, src);
  const buffer = await sharp(source).resize({width: 900, withoutEnlargement: true}).webp({quality: 58, effort: 6}).toBuffer();
  const target = join(ROOT, 'docs/ui-kits/references', name);
  ensureDir(target);
  writeFileSync(target, buffer);
  return {source: statSync(source).size, output: buffer.length, target: `docs/ui-kits/references/${name}`};
}

async function contactSheet(files, target) {
  const tiles = [];
  let x = 12, y = 12, rowHeight = 0;
  for (const file of files) {
    const tile = await sharp(join(ROOT, file)).resize({height: 220, width: 460, fit: 'inside'}).toBuffer({resolveWithObject: true});
    if (x + tile.info.width > 1000) {
      x = 12;
      y += rowHeight + 12;
      rowHeight = 0;
    }
    tiles.push({input: tile.data, left: x, top: y});
    x += tile.info.width + 12;
    rowHeight = Math.max(rowHeight, tile.info.height);
  }
  await sharp({create: {width: 1012, height: y + rowHeight + 12, channels: 4, background: '#1d6fd6'}})
    .composite(tiles)
    .png()
    .toFile(target);
}

const [kitsArg, ...rest] = process.argv.slice(2);
if (!kitsArg) {
  console.error('Usage: node scripts/import-ui-kits.mjs <extracted-kits-dir> [--sheet <file.png>]');
  process.exit(1);
}
const kits = resolve(kitsArg);
for (const kit of [HUB, HUD, DIALOGUE]) {
  if (!existsSync(join(kits, kit))) {
    console.error(`Missing ${kit} in ${kits}`);
    process.exit(1);
  }
}

const results = [];
for (const item of ART) results.push(await writeArt(kits, item));
for (const reference of REFERENCES) results.push(await writeReference(kits, reference));
for (const [src, name] of LAYOUTS) {
  const target = join(ROOT, 'docs/ui-kits/layouts', name);
  ensureDir(target);
  copyFileSync(join(kits, src), target);
}

let before = 0, after = 0;
for (const r of results) {
  before += r.source;
  after += r.output;
  console.log(`${r.target.padEnd(52)} ${String(Math.round(r.source / 1024)).padStart(5)} KB -> ${String(Math.round(r.output / 1024)).padStart(4)} KB`);
}
console.log(`total ${Math.round(before / 1024)} KB -> ${Math.round(after / 1024)} KB (+ ${LAYOUTS.length} layout files)`);

const sheetIndex = rest.indexOf('--sheet');
if (sheetIndex >= 0 && rest[sheetIndex + 1]) {
  await contactSheet(ART.map((item) => item.out), resolve(rest[sheetIndex + 1]));
  console.log(`contact sheet: ${rest[sheetIndex + 1]}`);
}
