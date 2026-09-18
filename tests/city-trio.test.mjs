import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { REFERENCE_BUILDINGS } from '../src/assets/reference-buildings.ts';
import { createReferenceBuildingLibrary } from '../src/renderer/three/reference-building-library.ts';
import { ELEVATED_RAIL } from '../src/renderer/environment/elevated-rail-layout.ts';

const configs = [
  ['cyberbase-tower', '01-cyberbase-tower.png', 28],
  ['japanese-parts-shop', '02-japanese-parts-shop.png', 10.7],
  ['urban-office', '03-urban-office.png', 11],
];
const sha = data => createHash('sha256').update(data).digest('hex');

for (const [slug, concept, height] of configs) {
  const asset = REFERENCE_BUILDINGS.find(item => item.id === `building-${slug}`);
  const bytes = readFileSync(new URL(`../public${asset.url}`, import.meta.url));
  const length = bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.subarray(20, 20 + length));
  const binary = bytes.subarray(28 + length);
  const parse = () => {
    const loader = new GLTFLoader();
    loader.register(() => ({ name: 'TEST_IMAGE_DECODER', loadTexture: () => Promise.resolve(new T.Texture()) }));
    return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  };

  test(`${slug}: original artwork, opaque materials, compact self-contained game export`, () => {
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    assert.ok(bytes.length < 3.3 * 1024 * 1024);
    assert.ok(doc.materials.some(m => m.name.startsWith('CBR1_Concrete')));
    assert.ok(doc.materials.every(m => !m.alphaMode || m.alphaMode === 'OPAQUE'));
    assert.ok(!doc.animations?.length && !doc.cameras?.length && !doc.skins?.length);
    assert.ok(!doc.extensionsUsed?.includes('KHR_lights_punctual'));
    assert.equal(doc.images.length, 3);
    assert.ok(doc.images.every(i => i.bufferView !== undefined && !i.uri));
    const source = readFileSync(new URL(`../output/building-concepts/2026-09-18-cyberbase-parts-office-v1/${concept}`, import.meta.url));
    assert.ok(doc.images.some(i => {
      const view = doc.bufferViews[i.bufferView];
      return sha(binary.subarray(view.byteOffset, view.byteOffset + view.byteLength)) === sha(source);
    }), 'approved source pixels remain unchanged');
  });

  test(`${slug}: finite indexed geometry, grounded closed shell, bounded dimensions and draw budget`, async () => {
    const { scene } = await parse();
    scene.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(scene);
    const size = bounds.getSize(new T.Vector3());
    assert.ok(Math.abs(bounds.min.y) < 1e-4);
    assert.ok(Math.abs(bounds.min.x + bounds.max.x) < 1e-4);
    assert.ok(Math.abs(bounds.min.z + bounds.max.z) < 1e-4);
    assert.ok(Math.abs(size.y - height) < .01);
    assert.ok(size.x < 12 && size.z < 11);
    if (slug === 'urban-office') assert.ok(size.y < ELEVATED_RAIL.deckY - 1.1);
    let triangles = 0, draws = 0;
    scene.traverse(object => {
      if (!object.isMesh) return;
      const g = object.geometry;
      draws++; triangles += g.index.count / 3;
      assert.ok(g.attributes.normal && g.attributes.uv);
      for (const attr of Object.values(g.attributes)) assert.ok(Array.from(attr.array).every(Number.isFinite));
      for (const index of g.index.array) assert.ok(index < g.attributes.position.count);
    });
    assert.ok(triangles < 8000, `${triangles} triangles`);
    assert.ok(draws <= 10, `${draws} draws`);
    for (const y of [1, height * .5, height * .8]) {
      for (const [x, z] of [[30, 0], [-30, 0], [0, 30], [0, -30]]) {
        const origin = new T.Vector3(x, y, z);
        const direction = new T.Vector3(0, y, 0).sub(origin).normalize();
        assert.ok(new T.Raycaster(origin, direction).intersectObject(scene, true).length, 'closed elevation');
      }
    }
    if (slug === 'cyberbase-tower') {
      const ribbon = scene.getObjectByName('CBCT1_VerticalTicker');
      assert.ok(ribbon?.isMesh && ribbon.userData.static_ticker);
      const uv = ribbon.geometry.attributes.uv1;
      assert.ok(uv, 'future downward ticker has a continuous UV channel');
      for (const value of uv.array) assert.ok(value >= -.001 && value <= 1.001);
      assert.ok(Array.from(uv.array).some((v, i) => i % 2 === 1 && v > .999));
    }
  });

  test(`${slug}: lazy shared instances retain independent transforms and dispose once`, async () => {
    let loads = 0;
    const library = createReferenceBuildingLibrary(4, async () => { loads++; return parse(); }, async () => new T.Texture());
    await Promise.all([library.prepare(asset.id), library.prepare(asset.id)]);
    assert.equal(loads, 1);
    const a = library.create(asset.id), b = library.create(asset.id);
    a.position.x = 20;
    assert.equal(b.position.x, 0);
    const resources = new Set();
    a.traverse(object => {
      if (!object.isMesh) return;
      const peer = b.getObjectByName(object.name);
      assert.equal(object.geometry, peer.geometry);
      assert.equal(object.material, peer.material);
      resources.add(object.geometry); resources.add(object.material);
    });
    const counts = new Map();
    for (const r of resources) r.addEventListener('dispose', () => counts.set(r, (counts.get(r) ?? 0) + 1));
    library.dispose(); library.dispose();
    assert.equal(counts.size, resources.size);
    assert.ok([...counts.values()].every(n => n === 1));
  });
}
