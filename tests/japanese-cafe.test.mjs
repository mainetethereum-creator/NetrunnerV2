import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ASSET_URLS } from '../src/assets/registry.ts';
import { REFERENCE_BUILDINGS } from '../src/assets/reference-buildings.ts';
import { createReferenceBuildingLibrary } from '../src/renderer/three/reference-building-library.ts';

const bytes = readFileSync(new URL('../public' + ASSET_URLS.referenceBuildings.japaneseCafe, import.meta.url));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
const binary = bytes.subarray(28 + jsonLength);

function parse() {
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'TEST_IMAGE_DECODER', loadTexture: () => Promise.resolve(new T.Texture()) }));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}

test('Japanese cafe embeds approved artwork and follows the shared opaque concrete asset contract', () => {
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.ok(REFERENCE_BUILDINGS.some(a => a.id === 'building-japanese-cafe' && a.url === ASSET_URLS.referenceBuildings.japaneseCafe));
  assert.ok(gltf.materials.some(m => m.name === 'CBR1_Concrete_JapaneseCafe'));
  assert.ok(gltf.materials.every(m => !m.alphaMode || m.alphaMode === 'OPAQUE'));
  const art = gltf.materials.find(m => m.name === 'CBJ1_ApprovedArtwork');
  const image = gltf.textures[art.pbrMetallicRoughness.baseColorTexture.index].source;
  assert.equal(image, gltf.textures[art.emissiveTexture.index].source);
  const view = gltf.bufferViews[gltf.images[image].bufferView];
  const embedded = binary.subarray(view.byteOffset, view.byteOffset + view.byteLength);
  const source = readFileSync(new URL('../output/building-concepts/2026-09-18-japan-wallet-v1/01-japanese-cafe.png', import.meta.url));
  const sha = data => createHash('sha256').update(data).digest('hex');
  assert.equal(sha(embedded), sha(source));
  assert.equal(gltf.images.length, 3);
  assert.ok(gltf.images.every(image => image.bufferView !== undefined && !image.uri));
  assert.ok(!gltf.animations?.length && !gltf.cameras?.length && !gltf.skins?.length);
  assert.ok(!gltf.extensionsUsed?.includes('KHR_lights_punctual'));
});

test('Japanese cafe is closed, grounded, compact and within game geometry/file budgets', async () => {
  assert.ok(bytes.length < 3.3 * 1024 * 1024);
  const { scene } = await parse();
  scene.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(scene);
  const size = bounds.getSize(new T.Vector3());
  assert.ok(Math.abs(bounds.min.y) < 1e-4);
  assert.ok(Math.abs(bounds.min.x + bounds.max.x) < 1e-4);
  assert.ok(Math.abs(bounds.min.z + bounds.max.z) < 1e-4);
  assert.ok(size.x < 7.8 && size.z < 6.5 && size.y < 8);
  assert.ok(size.x > 7 && size.z > 6 && size.y > 7);
  let triangles = 0, draws = 0;
  scene.traverse(object => {
    if (!object.isMesh) return;
    const geometry = object.geometry;
    draws++;
    assert.ok(geometry.index && geometry.attributes.uv && geometry.attributes.normal);
    triangles += geometry.index.count / 3;
    for (const attr of Object.values(geometry.attributes)) assert.ok(Array.from(attr.array).every(Number.isFinite));
    for (const index of geometry.index.array) assert.ok(index < geometry.attributes.position.count);
  });
  assert.ok(triangles <= 8500, `${triangles} triangles`);
  assert.ok(draws <= 10, `${draws} draws`);
  for (const y of [1.5, 4.5]) for (const [x, z] of [[15, 0], [-15, 0], [0, 15], [0, -15]]) {
    const origin = new T.Vector3(x, y, z), direction = new T.Vector3(0, y, 0).sub(origin).normalize();
    assert.ok(new T.Raycaster(origin, direction).intersectObject(scene, true).length, `closed from ${x},${y},${z}`);
  }
});

test('cafe instances share one load and GPU resources without sharing transforms', async () => {
  let loads = 0;
  const library = createReferenceBuildingLibrary(4, async () => { loads++; return parse(); }, async () => new T.Texture());
  await Promise.all([library.prepare('building-japanese-cafe'), library.prepare('building-japanese-cafe')]);
  assert.equal(loads, 1);
  const first = library.create('building-japanese-cafe'), second = library.create('building-japanese-cafe');
  first.position.x = 12;
  assert.equal(second.position.x, 0);
  const resources = new Set();
  first.traverse(object => {
    if (!object.isMesh) return;
    const peer = second.getObjectByName(object.name);
    assert.equal(object.geometry, peer.geometry);
    assert.equal(object.material, peer.material);
    resources.add(object.geometry); resources.add(object.material);
  });
  const disposed = new Map();
  for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, (disposed.get(resource) ?? 0) + 1));
  library.dispose(); library.dispose();
  assert.equal(disposed.size, resources.size);
  assert.ok([...disposed.values()].every(count => count === 1));
});
