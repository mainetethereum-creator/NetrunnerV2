import fs from 'node:fs';
import sharp from 'sharp';
const path='public/game/rail-ruins/v1/rail-ruins.glb';
const raw=fs.readFileSync(path),length=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+length));
const binary=raw.subarray(28+length),images=new Map(doc.images.map(i=>[i.bufferView,i]));
const parts=[];let offset=0;
for(let i=0;i<doc.bufferViews.length;i++) {
  const view=doc.bufferViews[i],im=images.get(i);
  let bytes=binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
  if(im) {
    bytes=await sharp(bytes).webp(im.name?.includes('Normal')?{lossless:true,effort:4}:{quality:93,alphaQuality:100,effort:5}).toBuffer();
    im.mimeType='image/webp';
  }
  view.byteOffset=offset;view.byteLength=bytes.length;parts.push(bytes);offset+=bytes.length;
  const pad=(4-offset%4)%4;if(pad){parts.push(Buffer.alloc(pad));offset+=pad;}
}
for(const texture of doc.textures){texture.extensions={...texture.extensions,EXT_texture_webp:{source:texture.source}};delete texture.source;}
doc.extensionsUsed=[...new Set([...(doc.extensionsUsed??[]),'EXT_texture_webp'])];
doc.extensionsRequired=[...new Set([...(doc.extensionsRequired??[]),'EXT_texture_webp'])];doc.buffers[0].byteLength=offset;
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+offset,8);header.writeUInt32LE(json.length,12);header.write('JSON',16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(offset);binHeader.write('BIN\0',4);
fs.writeFileSync(path,Buffer.concat([header,json,binHeader,...parts]));
const metrics=JSON.parse(fs.readFileSync('output/rail-ruins/metrics.json'));
metrics.compressedBytes=fs.statSync(path).size;fs.writeFileSync('output/rail-ruins/metrics.json',JSON.stringify(metrics,null,2));console.log(metrics);


