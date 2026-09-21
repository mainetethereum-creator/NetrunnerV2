import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import sharp from 'sharp';

const inputPath = 'public/game/park/sakura-v1/sakura-kit.glb';
const outputPath = 'public/game/park/sakura-v1/sakura-kit-ktx2.glb';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const document = await io.read(inputPath);
const imageDecoder = async buffer => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};
const common = {
  generateMipmap: true,
  enableDebug: false,
  imageDecoder,
};

await document.transform(
  ktx2({ ...common, pattern: /-normal$/, isUASTC: true, needSupercompression: true, enableRDO: true, rdoQualityLevel: 1,
    uastcLDRQualityLevel: 2, isNormalMap: true, isPerceptual: false, isSetKTX2SRGBTransferFunc: false }),
  ktx2({ ...common, pattern: /^(Basalt|Sign|Washi|Cedar|Bark|Moss|Noren)$/, isUASTC: false, qualityLevel: 255, compressionLevel: 4,
    isNormalMap: false, isPerceptual: true, isSetKTX2SRGBTransferFunc: true }),
);
await io.write(outputPath, document);
console.log(JSON.stringify({ inputPath, outputPath }));
