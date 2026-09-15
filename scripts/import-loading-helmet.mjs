// Imports the loading-screen helmet (400×400 pixel art) and splits it into two layers (ADR-021):
//   public/ui/loading/helmet.webp   — the helmet with its eyes switched off
//   public/ui/loading/eyes-red.webp — only the eye pixels, recoloured red, on transparency
// The loading screen animates the eye layer (glow, flicker, blink) over the helmet.
//
// Usage: node scripts/import-loading-helmet.mjs <helmet image>
// Requires `sharp` (installed with Next.js).
import sharp from 'sharp';
import {mkdirSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/ui/loading');
// Eye slits of the 400×400 source art: [x0, y0, x1, y1].
const EYE_BOXES = [[118, 186, 160, 202], [201, 186, 243, 202]];
// Dark socket colour that replaces the lit eye pixels on the helmet layer.
const SOCKET = [10, 20, 30];

const sourceArg = process.argv[2];
if (!sourceArg) {
  console.error('Usage: node scripts/import-loading-helmet.mjs <helmet image>');
  process.exit(1);
}
const source = resolve(sourceArg);
const {data, info} = await sharp(source).removeAlpha().raw().toBuffer({resolveWithObject: true});
if (info.width !== 400 || info.height !== 400) {
  console.error(`Expected 400×400 art, got ${info.width}×${info.height}; update EYE_BOXES for new art.`);
  process.exit(1);
}

const {width, height, channels} = info;
const helmet = Buffer.from(data);
const eyes = Buffer.alloc(width * height * 4);
let eyePixels = 0;

for (const [x0, y0, x1, y1] of EYE_BOXES) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const litCyan = b > 140 && g > 110 && b - r > 45 && r + g + b > 330;
      if (!litCyan) continue;
      const light = r * 0.3 + g * 0.59 + b * 0.11;
      const j = (y * width + x) * 4;
      eyes[j] = Math.min(255, 70 + light * 1.25);
      eyes[j + 1] = Math.min(255, light * 0.42);
      eyes[j + 2] = Math.min(255, light * 0.38);
      eyes[j + 3] = 255;
      helmet[i] = SOCKET[0];
      helmet[i + 1] = SOCKET[1];
      helmet[i + 2] = SOCKET[2];
      eyePixels++;
    }
  }
}

// The art sits on black. Fade the near-black background to transparent so no square shows over the
// loading screen's fog; dark sockets and armour (brighter than the threshold) stay opaque.
const helmetRgba = Buffer.alloc(width * height * 4);
for (let p = 0, q = 0; p < helmet.length; p += channels, q += 4) {
  const r = helmet[p];
  const g = helmet[p + 1];
  const b = helmet[p + 2];
  const peak = Math.max(r, g, b);
  helmetRgba[q] = r;
  helmetRgba[q + 1] = g;
  helmetRgba[q + 2] = b;
  helmetRgba[q + 3] = peak <= 10 ? 0 : peak >= 28 ? 255 : Math.round(((peak - 10) / 18) * 255);
}

mkdirSync(OUT, {recursive: true});
const helmetFile = await sharp(helmetRgba, {raw: {width, height, channels: 4}}).webp({nearLossless: true, quality: 60, alphaQuality: 100, effort: 6}).toBuffer();
const eyesFile = await sharp(eyes, {raw: {width, height, channels: 4}}).webp({lossless: true, effort: 6}).toBuffer();
writeFileSync(join(OUT, 'helmet.webp'), helmetFile);
writeFileSync(join(OUT, 'eyes-red.webp'), eyesFile);

console.log(`eye pixels: ${eyePixels}`);
console.log(`helmet.webp ${Math.round(helmetFile.length / 1024)} KB, eyes-red.webp ${Math.round(eyesFile.length / 1024)} KB (source ${Math.round(statSync(source).size / 1024)} KB)`);
