// Imports the hub feature cards (Season 1, SkyNet, NFT Collection) from the owner's
// HUBB folder: clean backgrounds, title artwork and "coming soon" badges.
// Frames and small texts are CSS / React (see docs/ui-kits/README.md).
//
// Usage:
//   node scripts/import-hub-cards.mjs <HUBB-folder> [--sheet <file.png>]
//
// Requires `sharp` (installed with Next.js).
import sharp from 'sharp';
import {existsSync, mkdirSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'public/ui/hub';

const SOURCES = {
  season: 'Изображение Codex 15 сент. 2026 г., 00_35_42.png',
  skynet: 'Изображение Codex 15 сент. 2026 г., 00_35_37.png',
  nft: 'Изображение Codex 15 сент. 2026 г., 00_35_27.png',
  titles: 'Изображение Codex 15 сент. 2026 г., 00_19_44.png',
  badges: 'Изображение Codex 15 сент. 2026 г., 00_19_32.png',
};

// Backgrounds without frames or text; the largest card is ~480 CSS px wide, 1280 px covers 2–3× screens.
// Images are cached for 30 days (next.config.ts), so replaced artwork gets a new file name.
const BACKGROUNDS = [
  ['season', 'feature-season.webp'],
  ['skynet', 'feature-skynet.webp'],
  ['nft', 'feature-nft.webp'],
];

// crop: [left, top, width, height] in source pixels, generous margins for the glow; then trimmed.
const CUTOUTS = [
  ['titles', [60, 95, 1000, 420], 'title-season.webp', 640],
  ['titles', [60, 588, 1000, 380], 'title-skynet.webp', 640],
  ['titles', [60, 1034, 1010, 310], 'title-nft.webp', 640],
  ['badges', [168, 105, 1115, 265], 'badge-season.webp', 480],
  ['badges', [162, 420, 1125, 257], 'badge-skynet.webp', 480],
  ['badges', [167, 729, 1117, 258], 'badge-nft.webp', 480],
];

const [folderArg, ...rest] = process.argv.slice(2);
if (!folderArg) {
  console.error('Usage: node scripts/import-hub-cards.mjs <HUBB-folder> [--sheet <file.png>]');
  process.exit(1);
}
const folder = resolve(folderArg);
for (const name of Object.values(SOURCES)) {
  if (!existsSync(join(folder, name))) {
    console.error(`Missing ${name} in ${folder}`);
    process.exit(1);
  }
}
mkdirSync(join(ROOT, OUT), {recursive: true});

const written = [];
for (const [key, file] of BACKGROUNDS) {
  const source = join(folder, SOURCES[key]);
  const {data, info} = await sharp(source)
    .resize({width: 1280, withoutEnlargement: true})
    .webp({quality: 90, effort: 6, smartSubsample: true})
    .toBuffer({resolveWithObject: true});
  writeFileSync(join(ROOT, OUT, file), data);
  written.push([file, statSync(source).size, info.size, `${info.width}x${info.height}`]);
}

for (const [key, [left, top, width, height], file, targetWidth] of CUTOUTS) {
  const source = join(folder, SOURCES[key]);
  const cropped = await sharp(source).extract({left, top, width, height}).png().toBuffer();
  const trimmed = await sharp(cropped).trim({threshold: 1}).png().toBuffer();
  const {data, info} = await sharp(trimmed)
    .resize({width: targetWidth, withoutEnlargement: true})
    .webp({quality: 92, alphaQuality: 95, effort: 6})
    .toBuffer({resolveWithObject: true});
  writeFileSync(join(ROOT, OUT, file), data);
  written.push([file, null, info.size, `${info.width}x${info.height} ratio ${(info.width / info.height).toFixed(3)}`]);
}

for (const [file, before, after, size] of written) {
  const from = before === null ? '' : `${Math.round(before / 1024)} KB -> `;
  console.log(`${OUT}/${file}`.padEnd(34), `${from}${Math.round(after / 1024)} KB`, size);
}

const sheetIndex = rest.indexOf('--sheet');
if (sheetIndex >= 0 && rest[sheetIndex + 1]) {
  const tiles = [];
  let y = 10;
  for (const [file] of written) {
    const tile = await sharp(join(ROOT, OUT, file)).resize({width: 460}).png().toBuffer({resolveWithObject: true});
    tiles.push({input: tile.data, left: 10, top: y});
    y += tile.info.height + 10;
  }
  await sharp({create: {width: 480, height: y, channels: 4, background: '#1a2a40'}})
    .composite(tiles)
    .png()
    .toFile(resolve(rest[sheetIndex + 1]));
  console.log(`contact sheet: ${rest[sheetIndex + 1]}`);
}
