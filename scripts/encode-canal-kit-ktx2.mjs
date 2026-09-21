import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import sharp from 'sharp';

const inputPath = 'public/game/canal/v1/canal-kit.glb';
const outputPath = 'public/game/canal/v1/canal-kit-ktx2.glb';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const document = await io.read(inputPath);
const imageDecoder = async buffer => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};
const common = { generateMipmap: true, enableDebug: false, imageDecoder };

// Keep the foliage cutout as its exact WebP source. Its fine alpha coverage is
// more sensitive to block compression than the opaque canal surfaces.
await document.transform(
  ktx2({ ...common, pattern: /-normal$/, isUASTC: true, needSupercompression: true, enableRDO: true,
    rdoQualityLevel: 1, uastcLDRQualityLevel: 2, isNormalMap: true, isPerceptual: false,
    isSetKTX2SRGBTransferFunc: false }),
  ktx2({ ...common, pattern: /^(Rock|Iron|Masonry|Washi|Cedar|Paving|Moss)$/, isUASTC: false,
    qualityLevel: 255, compressionLevel: 4, isNormalMap: false, isPerceptual: true,
    isSetKTX2SRGBTransferFunc: true }),
);
await io.write(outputPath, document);
console.log(JSON.stringify({ inputPath, outputPath }));
