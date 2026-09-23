/** Losslessly externalize repeated reference-building JPEG payloads.
 * Run: node --experimental-strip-types scripts/externalize-building-images.mjs
 * Geometry, material and image bytes are copied verbatim. Original GLBs remain.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSET_URLS } from '../src/assets/registry.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shared = new Map([
  ['e3b7c430a78e003a5754238f3d4b6e78e24dba86b894e4133ba9ccb06eb18aa8', ASSET_URLS.buildingSharedImages.surface],
  ['ad1a863dd63bf9ab10b781c941b715125f5484f89b64b0756e18beb083fa1af2', ASSET_URLS.buildingSharedImages.concrete],
]);
const seen = new Map();
const align4 = n => (n + 3) & ~3;
const filePath = url => join(root, 'public', url.slice(1));

function parseGlb(file) {
  assert.equal(file.toString('ascii', 0, 4), 'glTF');
  assert.equal(file.readUInt32LE(4), 2);
  assert.equal(file.readUInt32LE(8), file.length);
  let doc, bin;
  for (let offset = 12; offset < file.length;) {
    const length = file.readUInt32LE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const bytes = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'JSON') doc = JSON.parse(bytes.toString());
    if (type === 'BIN\0') bin = bytes;
    offset += 8 + length;
  }
  assert.ok(doc && bin, 'Expected GLB JSON and BIN chunks');
  assert.equal(doc.buffers.length, 1);
  return { doc, bin };
}

function makeGlb(doc, bin) {
  const json = Buffer.from(JSON.stringify(doc));
  const jsonChunk = Buffer.alloc(align4(json.length), 0x20);
  json.copy(jsonChunk);
  const binChunk = Buffer.alloc(align4(bin.length));
  bin.copy(binChunk);
  const output = Buffer.alloc(12 + 8 + jsonChunk.length + 8 + binChunk.length);
  output.write('glTF', 0, 'ascii');
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(jsonChunk.length, 12);
  output.write('JSON', 16, 'ascii');
  jsonChunk.copy(output, 20);
  const binHeader = 20 + jsonChunk.length;
  output.writeUInt32LE(binChunk.length, binHeader);
  output.write('BIN\0', binHeader + 4, 'ascii');
  binChunk.copy(output, binHeader + 8);
  return output;
}

let sourceBytes = 0, outputBytes = 0, externalizedOccurrences = 0;
for (const sourceUrl of Object.values(ASSET_URLS.referenceBuildings)) {
  const sourceFile = readFileSync(filePath(sourceUrl));
  const { doc, bin } = parseGlb(sourceFile);
  const outputDoc = structuredClone(doc);
  const removedViews = new Set();
  for (const [index, image] of doc.images.entries()) {
    if (image.bufferView === undefined || image.mimeType !== 'image/jpeg') continue;
    const view = doc.bufferViews[image.bufferView];
    const bytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const url = shared.get(hash);
    if (!url) continue;
    assert.ok(!removedViews.has(image.bufferView), `${sourceUrl}: image bufferView unexpectedly shared`);
    removedViews.add(image.bufferView);
    outputDoc.images[index] = { ...image, uri: posix.relative(posix.dirname(sourceUrl), url) };
    delete outputDoc.images[index].bufferView;
    delete outputDoc.images[index].mimeType;
    if (seen.has(url)) assert.deepEqual(bytes, seen.get(url), `${url}: payload mismatch`);
    else seen.set(url, Buffer.from(bytes));
    externalizedOccurrences++;
  }
  assert.ok(removedViews.size > 0, `${sourceUrl}: no shared JPEG was found`);

  const viewMap = new Map(), pieces = [];
  let nextOffset = 0;
  outputDoc.bufferViews = [];
  for (const [index, view] of doc.bufferViews.entries()) {
    if (removedViews.has(index)) continue;
    const start = view.byteOffset ?? 0;
    const bytes = bin.subarray(start, start + view.byteLength);
    nextOffset = align4(nextOffset);
    viewMap.set(index, outputDoc.bufferViews.length);
    outputDoc.bufferViews.push({ ...view, byteOffset: nextOffset });
    pieces.push({ offset: nextOffset, bytes });
    nextOffset += bytes.length;
  }
  const remap = index => {
    assert.ok(viewMap.has(index), `${sourceUrl}: removed view still referenced`);
    return viewMap.get(index);
  };
  for (const image of outputDoc.images) if (image.bufferView !== undefined) image.bufferView = remap(image.bufferView);
  for (const accessor of outputDoc.accessors ?? []) {
    if (accessor.bufferView !== undefined) accessor.bufferView = remap(accessor.bufferView);
    if (accessor.sparse) {
      accessor.sparse.indices.bufferView = remap(accessor.sparse.indices.bufferView);
      accessor.sparse.values.bufferView = remap(accessor.sparse.values.bufferView);
    }
  }
  for (const mesh of outputDoc.meshes ?? []) for (const primitive of mesh.primitives) {
    const draco = primitive.extensions?.KHR_draco_mesh_compression;
    if (draco) draco.bufferView = remap(draco.bufferView);
  }
  outputDoc.buffers[0].byteLength = align4(nextOffset);
  const outputBin = Buffer.alloc(outputDoc.buffers[0].byteLength);
  for (const piece of pieces) piece.bytes.copy(outputBin, piece.offset);
  const outputFile = makeGlb(outputDoc, outputBin);

  // Verify every retained bufferView, including geometry and any unique images,
  // against the exact source bytes before writing a runtime asset.
  const reparsed = parseGlb(outputFile);
  for (const [oldIndex, newIndex] of viewMap) {
    const oldView = doc.bufferViews[oldIndex], newView = reparsed.doc.bufferViews[newIndex];
    assert.equal(newView.byteLength, oldView.byteLength);
    assert.deepEqual(
      reparsed.bin.subarray(newView.byteOffset, newView.byteOffset + newView.byteLength),
      bin.subarray(oldView.byteOffset ?? 0, (oldView.byteOffset ?? 0) + oldView.byteLength),
      `${sourceUrl}: bufferView ${oldIndex} changed`,
    );
  }
  for (const key of ['scenes', 'nodes', 'meshes', 'materials', 'textures', 'skins', 'animations', 'extensionsUsed', 'extensionsRequired']) {
    assert.deepEqual(reparsed.doc[key], doc[key], `${sourceUrl}: ${key} changed`);
  }
  const outputPath = filePath(ASSET_URLS.referenceBuildingShared(sourceUrl));
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, outputFile);
  sourceBytes += sourceFile.length;
  outputBytes += outputFile.length;
}
for (const [url, bytes] of seen) {
  const path = filePath(url);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}
assert.equal(seen.size, shared.size, 'Expected both shared JPEG payloads');
console.log(JSON.stringify({ models: Object.values(ASSET_URLS.referenceBuildings).length,
  externalizedOccurrences, sourceBytes, outputBytes, sharedImageBytes: [...seen.values()].reduce((n, b) => n + b.length, 0),
  allModelsTransferSavings: sourceBytes - outputBytes - [...seen.values()].reduce((n, b) => n + b.length, 0) }, null, 2));
