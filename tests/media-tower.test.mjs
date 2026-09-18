import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ASSET_URLS } from '../src/assets/registry.ts';
import { REFERENCE_BUILDINGS } from '../src/assets/reference-buildings.ts';
import { BASE_MEDIA_TOWER } from '../src/assets/media-tower.ts';
import { createMediaTower } from '../src/renderer/environment/media-tower.ts';
import { createReferenceBuildingLibrary } from '../src/renderer/three/reference-building-library.ts';
import { ELEVATED_RAIL, sampleRailRoute } from '../src/renderer/environment/elevated-rail-layout.ts';
import { canStand, findPath, SPAWN, clearBaseEditor } from '../components/base/world.ts';
import { bindBaseColliderEdit } from '../components/base/editor-colliders.ts';

const file = readFileSync(new URL('../public' + ASSET_URLS.referenceBuildings.mediaTower, import.meta.url));
const jsonLength = file.readUInt32LE(12);
const gltf = JSON.parse(file.subarray(20, 20 + jsonLength));
const binary = file.subarray(28 + jsonLength);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('media tower embeds the exact approved portrait in both color and emission', () => {
  assert.equal(file.toString('ascii', 0, 4), 'glTF');
  assert.equal(file.readUInt32LE(8), file.length);
  const media = gltf.materials.find(m => m.name === 'CBM1_ApprovedMedia');
  const colorImage = gltf.textures[media.pbrMetallicRoughness.baseColorTexture.index].source;
  assert.equal(colorImage, gltf.textures[media.emissiveTexture.index].source);
  const view = gltf.bufferViews[gltf.images[colorImage].bufferView];
  const embedded = binary.subarray(view.byteOffset, view.byteOffset + view.byteLength);
  const original = readFileSync(new URL('../output/building-concepts/2026-09-18-glass-neon-v1/01-media-tower.png', import.meta.url));
  assert.equal(sha(embedded), sha(original), 'the face must not be regenerated or recompressed');
  assert.ok(media.emissiveFactor.every(v => v > .6 && v < 1.1));
  assert.ok(REFERENCE_BUILDINGS.some(a => a.id === 'building-media-tower' && a.url === ASSET_URLS.referenceBuildings.mediaTower));
});

test('real tower GLB is grounded, closed on every elevation and within its low-poly budget', async () => {
  assert.ok(file.length < 3.5 * 1024 * 1024);
  assert.equal(gltf.scenes.length, 1);
  assert.equal(gltf.scenes[0].nodes.length, 1);
  assert.ok(gltf.nodes.every(n => !/Train|RailDeck|Administration/.test(n.name ?? '')));
  assert.ok(!gltf.animations?.length && !gltf.cameras?.length && !gltf.skins?.length);
  assert.ok(!gltf.extensionsUsed?.includes('KHR_lights_punctual'));
  for (const image of gltf.images) assert.ok(image.bufferView !== undefined && !image.uri);
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'TEST_IMAGE_DECODER', loadTexture: () => Promise.resolve(new T.Texture()) }));
  const parsed = await loader.parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  const box = new T.Box3().setFromObject(parsed.scene);
  const size = box.getSize(new T.Vector3());
  assert.ok(Math.abs(box.min.y) < .001);
  assert.ok(Math.abs(box.min.x + box.max.x) < .001 && Math.abs(box.min.z + box.max.z) < .001);
  assert.ok(Math.abs(size.x - BASE_MEDIA_TOWER.width) < .01);
  assert.ok(Math.abs(size.z - BASE_MEDIA_TOWER.depth) < .01);
  assert.ok(size.y > 34 && size.y < 35);
  let triangles = 0, draws = 0;
  parsed.scene.traverse(o => {
    if (!o.isMesh) return;
    draws++; triangles += o.geometry.index.count / 3;
    for (const attr of Object.values(o.geometry.attributes)) assert.ok(Array.from(attr.array).every(Number.isFinite));
    for (const index of o.geometry.index.array) assert.ok(index < o.geometry.attributes.position.count);
  });
  assert.ok(triangles > 4000 && triangles <= 7500, `${triangles} triangles`);
  assert.ok(draws <= 9);
  parsed.scene.updateMatrixWorld(true);
  for (const position of [[0,15,15],[0,15,-15],[15,15,0],[-15,15,0]]) {
    const from = new T.Vector3(...position), to = new T.Vector3(0,15,0);
    assert.ok(new T.Raycaster(from, to.sub(from).normalize()).intersectObject(parsed.scene, true).length, `closed facade from ${position}`);
  }
});

test('Base tower has an open approach, clears rail and responds to editor move/delete', () => {
  const { x, y, z, width, depth } = BASE_MEDIA_TOWER;
  assert.equal(canStand({ x, z }), false);
  assert.ok(findPath(SPAWN, { x, z: z + depth / 2 + 1 }).length);
  for (let distance = -4; distance <= 8; distance += .25) {
    const point = sampleRailRoute(distance);
    const dx = Math.max(0, Math.abs(point.x - x) - width / 2);
    const dz = Math.max(0, Math.abs(point.z - z) - depth / 2);
    assert.ok(Math.hypot(dx,dz) > ELEVATED_RAIL.deckWidth / 2 + 1, 'railway stays behind the portrait tower');
  }
  const root = new T.Group(); root.position.set(x,y,z);
  const change = bindBaseColliderEdit('base:media-tower', root);
  try {
    change({ deleted: true }); assert.equal(canStand({x,z}), true);
    change({}); assert.equal(canStand({x,z}), false);
    root.position.x = -27; root.position.z = -24; change({});
    assert.equal(canStand({x,z}), true);
    assert.equal(canStand({x:-27,z:-24}), false);
  } finally { clearBaseEditor(); }
});

test('tower teardown owns resources once and ignores an in-flight completion', async () => {
  let resolve, notifications = 0;
  const model = new T.Group(), geometry = new T.BoxGeometry(), material = new T.MeshStandardMaterial();
  model.add(new T.Mesh(geometry, material));
  let geometryDisposals = 0, materialDisposals = 0;
  geometry.addEventListener('dispose', () => geometryDisposals++);
  material.addEventListener('dispose', () => materialDisposals++);
  const library = createReferenceBuildingLibrary(4, () => new Promise(r => { resolve = r; }));
  const scene = new T.Scene();
  const tower = createMediaTower(scene, library, () => notifications++, () => notifications++);
  tower.dispose(); tower.dispose(); resolve({scene:model}); await tower.ready;
  assert.equal(scene.children.length, 0); assert.equal(notifications, 0);
  assert.equal(geometryDisposals, 1); assert.equal(materialDisposals, 1);
});

test('loaded Base tower uses library-owned resources and errors keep the scene usable', async () => {
  const model = new T.Group(), geometry = new T.BoxGeometry(), material = new T.MeshStandardMaterial();
  model.add(new T.Mesh(geometry,material)); let disposed = 0, loaded = 0;
  geometry.addEventListener('dispose', () => disposed++);
  const scene = new T.Scene();
  const tower = createMediaTower(scene, createReferenceBuildingLibrary(4,async()=>({scene:model})), assert.fail, () => loaded++);
  await tower.ready;
  assert.equal(loaded, 1); assert.equal(tower.root.children.length,1);
  assert.deepEqual(tower.root.position.toArray(),[BASE_MEDIA_TOWER.x,BASE_MEDIA_TOWER.y,BASE_MEDIA_TOWER.z]);
  tower.dispose(); tower.dispose(); assert.equal(disposed,1); assert.equal(scene.children.length,0);
  const errors = [];
  const failed = createMediaTower(scene,createReferenceBuildingLibrary(4,async()=>{throw Error('offline');}),m=>errors.push(m),()=>loaded++);
  await failed.ready; assert.equal(errors.length,1); assert.equal(loaded,2);
  failed.dispose(); assert.equal(scene.children.length,0);
});
