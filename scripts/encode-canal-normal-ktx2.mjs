import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { encodeToKTX2 } from 'ktx2-encoder';

const inputPath = 'public/game/canal/v1/water-normal.webp';
const outputPath = 'public/game/canal/v1/water-normal.ktx2';
const input = new Uint8Array(readFileSync(inputPath));
const imageDecoder = async buffer => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};
const output = await encodeToKTX2(input, {
  isUASTC: true,
  isNormalMap: true,
  isPerceptual: false,
  isSetKTX2SRGBTransferFunc: false,
  generateMipmap: true,
  needSupercompression: true,
  enableRDO: true,
  rdoQualityLevel: 1,
  uastcLDRQualityLevel: 2,
  enableDebug: false,
  imageDecoder,
});

writeFileSync(outputPath, output);
console.log(JSON.stringify({ inputPath, outputPath, inputBytes: input.byteLength, outputBytes: output.byteLength }));
