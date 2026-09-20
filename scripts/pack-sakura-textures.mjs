// Compress generated colour textures; keep all Blender source images lossless.
import fs from 'node:fs';
import sharp from 'sharp';
const path = 'public/game/park/sakura-v1/sakura-kit.glb';
const raw = fs.readFileSync(path), jsonLength = raw.readUInt32LE(12);
const doc = JSON.parse(raw.subarray(20,20+jsonLength));
const bin = raw.subarray(28+jsonLength), images = new Map(doc.images.map(image=>[image.bufferView,image]));
const chunks=[]; let offset=0;
for (let i=0;i<doc.bufferViews.length;i++) {
  const view=doc.bufferViews[i], image=images.get(i);
  let bytes=bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
  if(image) {
    bytes=await sharp(bytes).webp(image.name?.includes('Normal')?{lossless:true,effort:4}:{quality:92,alphaQuality:100,effort:5}).toBuffer();
    image.mimeType='image/webp';
  }
  view.byteOffset=offset;view.byteLength=bytes.length;chunks.push(bytes);offset+=bytes.length;
  const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}
}
for (const texture of doc.textures) {texture.extensions={...texture.extensions,EXT_texture_webp:{source:texture.source}};delete texture.source;}
doc.extensionsUsed=[...new Set([...(doc.extensionsUsed??[]),'EXT_texture_webp'])];
doc.extensionsRequired=[...new Set([...(doc.extensionsRequired??[]),'EXT_texture_webp'])];
doc.buffers[0].byteLength=offset;
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+offset,8);header.writeUInt32LE(json.length,12);header.write('JSON',16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(offset);binHeader.write('BIN\0',4);
fs.writeFileSync(path,Buffer.concat([header,json,binHeader,...chunks]));
const metrics=JSON.parse(fs.readFileSync('output/sakura-park/metrics.json'));
metrics.compressedBytes=fs.statSync(path).size;fs.writeFileSync('output/sakura-park/metrics.json',JSON.stringify(metrics,null,2));
await sharp('output/sakura-park/textures/Sign.png').webp({quality:95}).toFile('public/game/park/sakura-v1/neon-sign.webp');
console.log(`${Math.round(raw.length/1024)} KiB → ${Math.round(metrics.compressedBytes/1024)} KiB`);
