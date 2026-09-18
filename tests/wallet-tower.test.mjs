import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ASSET_URLS } from '../src/assets/registry.ts';
import { REFERENCE_BUILDINGS } from '../src/assets/reference-buildings.ts';
import { createReferenceBuildingLibrary } from '../src/renderer/three/reference-building-library.ts';

const bytes = readFileSync(new URL('../public' + ASSET_URLS.referenceBuildings.walletTower, import.meta.url));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
const binary = bytes.subarray(28 + jsonLength);

function parse() {
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'TEST_IMAGE_DECODER', loadTexture: () => Promise.resolve(new T.Texture()) }));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}

test('wallet tower preserves approved advertising and limits transparency to the static ticker', () => {
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.ok(REFERENCE_BUILDINGS.some(a => a.id === 'building-wallet-tower' && a.url === ASSET_URLS.referenceBuildings.walletTower));
  assert.ok(gltf.materials.some(m => m.name === 'CBR1_Concrete_WalletTower'));
  const art = gltf.materials.find(m => m.name === 'CBW1_ApprovedMedia');
  const ribbon = gltf.materials.find(m => m.name === 'CBW1_StaticHologramRibbon');
  const image = gltf.textures[art.pbrMetallicRoughness.baseColorTexture.index].source;
  assert.equal(image, gltf.textures[art.emissiveTexture.index].source);
  assert.equal(image, gltf.textures[ribbon.pbrMetallicRoughness.baseColorTexture.index].source);
  const view = gltf.bufferViews[gltf.images[image].bufferView];
  const embedded = binary.subarray(view.byteOffset, view.byteOffset + view.byteLength);
  const source = readFileSync(new URL('../output/building-concepts/2026-09-18-japan-wallet-v1/02-wallet-tower.png', import.meta.url));
  const sha = data => createHash('sha256').update(data).digest('hex');
  assert.equal(sha(embedded), sha(source));
  assert.equal(gltf.materials.filter(m => m.alphaMode === 'BLEND').length, 1);
  assert.equal(ribbon.alphaMode, 'BLEND');
  assert.equal(ribbon.doubleSided, false);
  assert.equal(ribbon.pbrMetallicRoughness.baseColorFactor[3], .84);
  assert.equal(gltf.images.length, 3);
  assert.ok(gltf.images.every(image => image.bufferView !== undefined && !image.uri));
  assert.ok(!gltf.animations?.length && !gltf.cameras?.length && !gltf.skins?.length);
  assert.ok(!gltf.extensionsUsed?.includes('KHR_lights_punctual'));
});

test('wallet tower geometry has grounded closed facades, safe UVs and a low game budget', async () => {
  assert.ok(bytes.length < 3.3 * 1024 * 1024);
  const { scene } = await parse();
  scene.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(scene);
  const size = bounds.getSize(new T.Vector3());
  assert.ok(Math.abs(bounds.min.y) < 1e-4);
  assert.ok(Math.abs(bounds.min.x + bounds.max.x) < 1e-4);
  assert.ok(Math.abs(bounds.min.z + bounds.max.z) < 1e-4);
  assert.ok(size.x < 8.3 && size.z < 7.8 && size.y < 33);
  assert.ok(size.x > 8 && size.z > 7 && size.y > 32);
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
  assert.ok(triangles <= 8000, `${triangles} triangles`);
  assert.ok(draws <= 10, `${draws} draws`);
  for (const y of [2, 8, 12, 23]) for (const [x, z] of [[20, 0], [-20, 0], [0, 20], [0, -20]]) {
    const origin = new T.Vector3(x, y, z), direction = new T.Vector3(0, y, 0).sub(origin).normalize();
    const hits = new T.Raycaster(origin, direction).intersectObject(scene, true);
    assert.ok(hits.some(hit => !hit.object.material.transparent), `closed opaque shell from ${x},${y},${z}`);
  }
  const ticker = scene.getObjectByName('CBW1_TickerRibbon');
  assert.ok(ticker?.isMesh && ticker.userData.static_ticker);
  const uv = ticker.geometry.attributes.uv1;
  assert.ok(uv, 'continuous perimeter channel retained for future ticker motion');
  const values = Array.from(uv.array);
  assert.ok(Math.min(...values) >= -1e-4 && Math.max(...values) <= 1.0001);
  assert.ok(values.some((n, i) => i % 2 === 0 && n < .001));
  assert.ok(values.some((n, i) => i % 2 === 0 && n > .999));
  const tickerSize = new T.Box3().setFromObject(ticker).getSize(new T.Vector3());
  assert.ok(tickerSize.y < 2.71 && tickerSize.y > 2.69, 'one narrow band, not translucent facade layers');
});

test('wallet tower loads once and shares immutable resources while retaining independent transforms', async () => {
  let loads = 0;
  const library = createReferenceBuildingLibrary(4, async () => { loads++; return parse(); }, async () => new T.Texture());
  await Promise.all([library.prepare('building-wallet-tower'), library.prepare('building-wallet-tower')]);
  assert.equal(loads, 1);
  const first = library.create('building-wallet-tower'), second = library.create('building-wallet-tower');
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
