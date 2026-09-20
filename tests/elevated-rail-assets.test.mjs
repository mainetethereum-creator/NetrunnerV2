import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createElevatedRail } from '../src/renderer/environment/elevated-rail.ts';
import { ELEVATED_RAIL, railSupportPoses, sampleRailRoute } from '../src/renderer/environment/elevated-rail-layout.ts';
import { ASSET_URLS } from '../src/assets/registry.ts';
import { disposeObjectTree } from '../src/renderer/three/dispose.ts';

test('short guideway stays behind the actual administration shell', async () => {
  const file = readFileSync(new URL(`../public${ASSET_URLS.referenceBuildings.administration}`, import.meta.url));
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'TEST_IMAGE_DECODER', loadTexture: () => Promise.resolve(new T.Texture()) }));
  const { scene } = await loader.parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  scene.position.set(12.3706, .08, -10.0715);
  scene.updateMatrixWorld(true);
  const building = new T.Box3().setFromObject(scene);
  for (let distance = 24; distance <= 40; distance += .25) {
    const point = sampleRailRoute(distance);
    const sides = [-ELEVATED_RAIL.deckWidth / 2, ELEVATED_RAIL.deckWidth / 2]
      .map(side => point.z + side * Math.cos(point.yaw));
    assert.ok(Math.max(...sides) < building.min.z - .5,
      'the complete deck width stays visibly behind administration');
  }
  disposeObjectTree(scene);
});

test('Blender railway fits its modular dimensions and renders the full line within its geometry budget', async () => {
  const file = readFileSync(new URL(`../public${ASSET_URLS.elevatedRail}`, import.meta.url));
  assert.equal(file.toString('ascii', 0, 4), 'glTF');
  assert.equal(file.readUInt32LE(4), 2);
  assert.equal(file.readUInt32LE(8), file.length);
  assert.ok(file.length < 1.5 * 1024 * 1024, 'standalone railway remains below 1.5 MB');
  const json = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString());
  assert.equal(json.images.length, 2, 'portable concrete and worn-metal surfaces');
  assert.ok(json.images.every(image => image.bufferView !== undefined && !image.uri));
  assert.ok(!json.animations?.length && !json.cameras?.length);
  assert.ok(!json.extensionsUsed?.includes('KHR_lights_punctual'));
  const names = ['RailDeck', 'RailPier', 'TrainCar', 'TrainMiddle'];
  assert.equal(json.scenes.length, 1, 'only the dedicated railway scene is exported');
  assert.deepEqual(json.scenes[0].nodes.map(index => json.nodes[index].name).sort(), [...names].sort(),
    'the open Blender file cannot leak buildings or other scenes into the asset');
  const findMaterial = name => json.materials.find(material => material.name.split('.')[0] === `CBRail_${name}`);
  const concrete = findMaterial('Concrete');
  assert.ok(concrete, 'shared concrete substitution recognizes the stable material prefix');
  assert.ok(concrete.pbrMetallicRoughness.baseColorTexture);
  assert.ok(concrete.pbrMetallicRoughness.baseColorFactor[0] < .4);
  const emission = material => material.emissiveFactor.map(value => value
    * (material.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1));
  for (const name of ['Headlight', 'CyanGuide', 'WarmWindows', 'AmberSignal']) {
    assert.ok(findMaterial(name), `the ${name} material is present`);
    assert.ok(emission(findMaterial(name)).some(value => value > 0), `${name} is self illuminated`);
  }
  assert.ok(Math.max(...emission(findMaterial('Headlight'))) >= 4, 'cab light remains legible in the night scene');
  assert.ok(emission(findMaterial('CyanGuide'))[2] > emission(findMaterial('CyanGuide'))[0]);
  assert.ok(emission(findMaterial('WarmWindows'))[0] > emission(findMaterial('WarmWindows'))[2]);

  // Exercise actual glTF parsing and runtime batching without image decoding/GPU.
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'TEST_IMAGE_DECODER', loadTexture: () => Promise.resolve(new T.Texture()) }));
  const loadModel = () => loader.parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  const gltf = await loadModel();
  let sourceDraws = 0;
  let sourceTriangles = 0;
  const instanceCounts = {
    RailDeck: ELEVATED_RAIL.deckCentres.length,
    RailPier: railSupportPoses().length,
    TrainCar: 2,
    TrainMiddle: 1,
  };
  for (const name of names) {
    const prototype = gltf.scene.getObjectByName(name);
    assert.ok(prototype, name);
    const box = new T.Box3().setFromObject(prototype);
    const size = box.getSize(new T.Vector3());
    if (name === 'RailDeck') {
      assert.ok(Math.abs(size.x - ELEVATED_RAIL.deckLength) < 1e-4);
      assert.ok(Math.abs(box.min.y + 1.1) < 1e-4);
      assert.ok(size.z > 4.4 && size.z < 4.5);
      assert.ok(Math.abs(box.min.x + 4) < 1e-4 && Math.abs(box.max.x - 4) < 1e-4,
        'lights and signal housings do not extend past the eight metre repeat');
      assert.ok(Math.max(Math.abs(box.min.z), Math.abs(box.max.z)) <= 2.25,
        'guide lights keep the original track clearance envelope');
    } else if (name === 'RailPier') {
      assert.ok(Math.abs(box.min.y) < 1e-4);
      assert.ok(Math.abs(box.max.y - 13.8) < 1e-4, 'source pier retains its original height; runtime fits the lowered deck');
      assert.ok(size.x < 2.9 && size.z > 7.4 && size.z < 7.6);
      assert.ok(box.min.z + ELEVATED_RAIL.pierOffsetZ < -ELEVATED_RAIL.deckWidth / 2
        && box.max.z + ELEVATED_RAIL.pierOffsetZ > ELEVATED_RAIL.deckWidth / 2,
      'cantilever capital reaches across the offset track deck');
    } else {
      assert.ok(Math.abs(box.min.y) < .02, 'low-poly wheels are grounded near the module origin');
      assert.ok(Math.abs(ELEVATED_RAIL.trainY + box.min.y - ELEVATED_RAIL.deckY - .19) < .001,
        'wheels contact the top of the rails without floating');
      assert.ok(size.x < ELEVATED_RAIL.carSpacing && size.x > 9);
      assert.ok(size.y < 3.1 && size.z < 2.8, 'rolling stock fits between deck parapets');
    }
    prototype.traverse(object => {
      if (!object.isMesh) return;
      const geometry = object.geometry;
      sourceDraws++;
      sourceTriangles += geometry.index.count / 3 * instanceCounts[name];
      assert.ok(geometry.index && geometry.attributes.uv && geometry.attributes.normal);
      for (const attribute of Object.values(geometry.attributes)) {
        assert.ok(Array.from(attribute.array).every(Number.isFinite));
      }
      for (const index of geometry.index.array) assert.ok(index < geometry.attributes.position.count);
      const normal = geometry.attributes.normal;
      for (let vertex = 0; vertex < normal.count; vertex++) {
        const length = Math.hypot(normal.getX(vertex), normal.getY(vertex), normal.getZ(vertex));
        assert.ok(Math.abs(length - 1) < .001, 'exported surface normals are normalized');
      }
    });
  }
  assert.ok(sourceDraws <= 28, `portable prototype kit uses ${sourceDraws} material draws`);
  assert.ok(sourceTriangles < 45000, `unwarped full line uses ${sourceTriangles} triangles`);
  for (const mobile of [true, false]) {
    const model = mobile ? gltf : await loadModel();
    const errors = [];
    const scene = new T.Scene();
    const rail = createElevatedRail(scene, { loadAsync: async () => model }, mobile,
      error => errors.push(error), undefined, async () => new T.Texture());
    await rail.ready;
    assert.deepEqual(errors, []);
    let triangles = 0;
    let draws = 0;
    let allTriangles = 0;
    let allDraws = 0;
    let lightCount = 0;
    const renderedPier = new T.Box3();
    rail.root.traverse(object => {
      if (object.isLight) {
        lightCount++;
        assert.equal(object.castShadow, false, 'transit lamps add no shadow passes');
      }
      if (!object.isMesh) return;
      const meshTriangles = (object.geometry.index?.count ?? object.geometry.attributes.position.count)
        / 3 * (object.count ?? 1);
      const meshDraws = Array.isArray(object.material) ? object.geometry.groups.length : 1;
      allTriangles += meshTriangles;
      allDraws += meshDraws;
      for (const attribute of Object.values(object.geometry.attributes)) {
        assert.ok(Array.from(attribute.array).every(Number.isFinite), 'all rail and city geometry attributes are finite');
      }
      if (!names.some(name => object.name.startsWith(name))) return;
      if (!object.name.startsWith('RailDeck')) {
        assert.ok(object.isInstancedMesh, 'repeated rolling stock and supports are GPU-instanced');
      }
      if (mobile) assert.equal(object.castShadow, false, 'mobile avoids moving shadow redraws');
      triangles += meshTriangles;
      draws += meshDraws;
      if (object.name.startsWith('RailPier')) renderedPier.union(new T.Box3().setFromObject(object));
    });
    assert.ok(draws <= 28, `full Blender line uses ${draws} material draws`);
    assert.ok(triangles < 73000, `curved subdivided line and three cars use ${triangles} triangles`);
    assert.ok(allDraws <= 34, `railway including cables, city details and bellows uses ${allDraws} draws`);
    assert.ok(allTriangles < 78000, `complete ${mobile ? 'mobile' : 'desktop'} transit uses ${allTriangles} triangles`);
    assert.ok(lightCount <= (mobile ? 1 : 3), 'dynamic lighting remains within the platform budget');
    assert.ok(Math.abs(renderedPier.min.y - Math.min(...railSupportPoses().map(p => p.y))) < 1e-4,
      'actual Blender pier bases follow the lowest terrain support');
    assert.ok(Math.abs(renderedPier.max.y - (ELEVATED_RAIL.deckY - 1.1)) < 1e-4,
      'actual shortened capitals meet the lowered deck');
    rail.dispose();
    assert.equal(scene.children.length, 0);
  }
});
