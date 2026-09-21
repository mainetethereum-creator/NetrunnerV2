import { writeFile } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import sharp from 'sharp';

const sourcePath = 'public/game/buildings/japanese-cafe-v1/japanese-cafe.glb';
const outputPath = 'public/game/buildings/shared/surface.ktx2';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const document = await io.read(sourcePath);
const surface = document.getRoot().listTextures().find(texture => texture.getName() === 'surface');
if (!surface) throw new Error('Shared building surface texture was not found');
const imageDecoder = async buffer => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};
await document.transform(ktx2({ pattern: /^surface$/, generateMipmap: true, enableDebug: false, imageDecoder,
  isUASTC: false, qualityLevel: 255, compressionLevel: 4, isNormalMap: false, isPerceptual: true,
  isSetKTX2SRGBTransferFunc: true }));
await writeFile(outputPath, surface.getImage());
console.log(JSON.stringify({ sourcePath, outputPath, bytes: surface.getImage().byteLength }));
