import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { LoaderUtils } from 'three';
import { ASSET_URLS, registeredAssetFiles } from '../src/assets/registry.ts';

function readUrl(url) {
  return readFileSync(new URL(`../public${url}`, import.meta.url));
}

function parse(url) {
  const file = readUrl(url);
  assert.equal(file.toString('ascii', 0, 4), 'glTF');
  assert.equal(file.readUInt32LE(8), file.length);
  const jsonSize = file.readUInt32LE(12);
  const doc = JSON.parse(file.subarray(20, 20 + jsonSize).toString());
  const binStart = 20 + jsonSize;
  const binSize = file.readUInt32LE(binStart);
  assert.equal(file.toString('ascii', binStart + 4, binStart + 8), 'BIN\0');
  return { file, doc, bin: file.subarray(binStart + 8, binStart + 8 + binSize) };
}

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const viewBytes = (model, view) => model.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);

test('shared reference GLBs preserve all artwork, geometry and material payloads exactly', () => {
  const registered = new Set(registeredAssetFiles());
  for (const url of Object.values(ASSET_URLS.buildingSharedImages)) {
    assert.ok(registered.has(url));
    assert.ok(readUrl(url).length > 0);
  }
  let externalImages = 0, savings = 0;
  for (const sourceUrl of Object.values(ASSET_URLS.referenceBuildings)) {
    const sharedUrl = ASSET_URLS.referenceBuildingShared(sourceUrl);
    assert.ok(registered.has(sharedUrl), `${sharedUrl} missing from registry`);
    const source = parse(sourceUrl), variant = parse(sharedUrl);
    for (const key of ['scenes', 'nodes', 'meshes', 'materials', 'textures', 'skins', 'animations', 'extensionsUsed', 'extensionsRequired']) {
      assert.deepEqual(variant.doc[key], source.doc[key], `${sourceUrl}: ${key}`);
    }
    assert.equal(variant.doc.images.length, source.doc.images.length);
    for (const [index, oldImage] of source.doc.images.entries()) {
      const newImage = variant.doc.images[index];
      assert.equal(newImage.name, oldImage.name);
      if (!newImage.uri) continue;
      assert.ok(!newImage.uri.startsWith('/'), 'GLTFLoader resolves image URIs relative to the model');
      const loaderPath = `${sharedUrl.slice(0, sharedUrl.lastIndexOf('/') + 1)}`;
      const resolved = new URL(LoaderUtils.resolveURL(newImage.uri, loaderPath), 'http://localhost:3000').pathname;
      assert.ok(Object.values(ASSET_URLS.buildingSharedImages).includes(resolved), `${sharedUrl}: ${newImage.uri} resolves to ${resolved}`);
      assert.equal(newImage.bufferView, undefined);
      assert.equal(newImage.mimeType, undefined);
      assert.equal(hash(viewBytes(source, source.doc.bufferViews[oldImage.bufferView])), hash(readUrl(resolved)));
      externalImages++;
    }
    for (const [index, oldImage] of source.doc.images.entries()) {
      const newImage = variant.doc.images[index];
      if (newImage.uri || oldImage.bufferView === undefined) continue;
      assert.deepEqual(
        viewBytes(variant, variant.doc.bufferViews[newImage.bufferView]),
        viewBytes(source, source.doc.bufferViews[oldImage.bufferView]),
        `${sourceUrl}: unique image ${index} payload`,
      );
    }
    for (const accessor of source.doc.accessors ?? []) {
      const index = source.doc.accessors.indexOf(accessor);
      const newer = variant.doc.accessors[index];
      const oldShape = { ...accessor }, newShape = { ...newer };
      delete oldShape.bufferView; delete newShape.bufferView;
      assert.deepEqual(newShape, oldShape, `${sourceUrl}: accessor ${index} changed`);
      if (accessor.bufferView === undefined) continue;
      const oldView = source.doc.bufferViews[accessor.bufferView];
      const newView = variant.doc.bufferViews[newer.bufferView];
      assert.deepEqual(viewBytes(variant, newView), viewBytes(source, oldView), `${sourceUrl}: accessor ${index} payload`);
    }
    savings += source.file.length - variant.file.length;
  }
  assert.equal(externalImages, 33);
  assert.equal(savings - Object.values(ASSET_URLS.buildingSharedImages).reduce((n, url) => n + readUrl(url).length, 0), 7_634_271);
});
