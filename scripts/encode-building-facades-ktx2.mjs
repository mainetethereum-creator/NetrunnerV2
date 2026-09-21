import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import sharp from 'sharp';

const files = [
  'japanese-cafe-v1/japanese-cafe.glb', 'glass-corner-v1/glass-corner.glb',
  'japanese-parts-shop-v1/japanese-parts-shop.glb', 'wallet-tower-v1/wallet-tower.glb',
  'cyberbase-tower-v1/cyberbase-tower.glb', 'media-tower-v1/media-tower.glb',
  'slender-glass-v1/slender-glass.glb', 'slender-terrace-v1/slender-terrace.glb',
  'corner-chamfer-v1/corner-chamfer.glb', 'corner-rounded-v1/corner-rounded.glb',
];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const imageDecoder = async buffer => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};
for (const relative of files) {
  const inputPath = `public/game/buildings/${relative}`;
  const outputPath = inputPath.replace(/\.glb$/, '-ktx2.glb');
  const document = await io.read(inputPath);
  await document.transform(ktx2({ pattern: /^(?!surface$|cold-concrete$).+/, generateMipmap: true,
    enableDebug: false, imageDecoder, isUASTC: false, qualityLevel: 255, compressionLevel: 4,
    isNormalMap: false, isPerceptual: true, isSetKTX2SRGBTransferFunc: true }));
  await io.write(outputPath, document);
  console.log(JSON.stringify({ inputPath, outputPath }));
}
