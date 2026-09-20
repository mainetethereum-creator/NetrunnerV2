import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { ELEVATED_RAIL, ELEVATED_RAIL_PERIOD, RAIL_BEND, elevatedTrainX, railPierFootprints, railSupportPoses, sampleRailRoute } from '../src/renderer/environment/elevated-rail-layout.ts';
import { createElevatedRail } from '../src/renderer/environment/elevated-rail.ts';

function fixture() {
  const scene = new T.Group();
  const texture = new T.Texture();
  const concrete = new T.MeshStandardMaterial({ map: texture });
  concrete.name = 'CBRail_Concrete';
  const metal = new T.MeshStandardMaterial({ map: texture });
  const resources = [texture, concrete, metal];
  for (const [name, size, material] of [
    ['RailDeck', [8, 1.1, 4.4], concrete],
    ['RailPier', [2, 15, 2], concrete],
    ['TrainCar', [9, 2.8, 2.5], metal],
    ['TrainMiddle', [9, 2.8, 2.5], metal],
  ]) {
    const group = new T.Group();
    group.name = name;
    const geometry = new T.BoxGeometry(...size);
    resources.push(geometry);
    const mesh = new T.Mesh(geometry, material);
    mesh.position.y = name === 'RailDeck' ? -size[1] / 2 : size[1] / 2;
    group.add(mesh);
    scene.add(group);
  }
  return { scene, resources };
}

function countDisposals(resources) {
  const counts = resources.map(() => 0);
  resources.forEach((resource, index) => resource.addEventListener('dispose', () => counts[index]++));
  return counts;
}

test('train advances in metres at the same speed across frame rates and wraps outside the complete line', () => {
  for (const fps of [30, 60, 144]) {
    let elapsed = 0;
    for (let step = 0; step < fps * 3; step++) elapsed += 1 / fps;
    assert.ok(Math.abs(elevatedTrainX(elapsed) - (ELEVATED_RAIL.initialX + 21)) < 1e-10);
  }
  const wrapTime = (ELEVATED_RAIL.loopEnd - ELEVATED_RAIL.initialX) / ELEVATED_RAIL.speed;
  const deckMin = Math.min(...ELEVATED_RAIL.deckCentres) - ELEVATED_RAIL.deckLength / 2;
  const deckMax = Math.max(...ELEVATED_RAIL.deckCentres) + ELEVATED_RAIL.deckLength / 2;
  const beforeWrap = elevatedTrainX(wrapTime - 1e-6);
  const afterWrap = elevatedTrainX(wrapTime + 1e-6);
  assert.ok(beforeWrap - ELEVATED_RAIL.carSpacing * 2 - ELEVATED_RAIL.carLength / 2 > deckMax);
  assert.ok(afterWrap + ELEVATED_RAIL.carLength / 2 < deckMin);
  assert.ok(Math.abs(elevatedTrainX(ELEVATED_RAIL_PERIOD + 3) - elevatedTrainX(3)) < 1e-10);
  for (const time of [0, 10, 100000, Infinity, NaN]) {
    assert.equal(elevatedTrainX(time, true), ELEVATED_RAIL.initialX);
  }
  // Physical speed must remain constant on the rear straight, circular bend,
  // both joins and the metro exit, rather than merely advancing a curve parameter.
  for (let distance = ELEVATED_RAIL.loopStart; distance < ELEVATED_RAIL.loopEnd; distance += .1) {
    const here = sampleRailRoute(distance);
    const ahead = sampleRailRoute(distance + .1);
    assert.ok(Math.abs(Math.hypot(ahead.x - here.x, ahead.z - here.z) - .1) < .0001);
    const curvature = Math.abs(ahead.yaw - here.yaw) / .1;
    assert.ok(curvature <= 1 / 31.9, 'long coaches need a broad bend without abrupt turns');
    const heading = -Math.atan2(ahead.z - here.z, ahead.x - here.x);
    assert.ok(Math.abs(heading - here.yaw) < .003, 'car orientation follows its own route tangent');
  }
  assert.deepEqual(sampleRailRoute(0), { x: -16, z: -28.5, yaw: 0 });
  assert.deepEqual(sampleRailRoute(RAIL_BEND.start), { x: 12, z: -28.5, yaw: 0 });
  assert.equal(sampleRailRoute(RAIL_BEND.end).yaw, -RAIL_BEND.angle);
  assert.equal(sampleRailRoute(60).yaw, -RAIL_BEND.angle, 'the saved city alignment remains unchanged');
  assert.equal(sampleRailRoute(120).yaw, -RAIL_BEND.angle, 'the live extension leaves eastwards, away from the garden');
  for (const join of [RAIL_BEND.start, RAIL_BEND.end]) {
    const before = sampleRailRoute(join - .00001), after = sampleRailRoute(join + .00001);
    assert.ok(Math.hypot(before.x - after.x, before.z - after.z) < .000021);
    assert.ok(Math.abs(before.yaw - after.yaw) < .000001);
  }
  const firstTail = sampleRailRoute(afterWrap);
  const lastTail = sampleRailRoute(beforeWrap - ELEVATED_RAIL.carSpacing * 2);
  assert.ok(firstTail.x < -24 && firstTail.z === -28.5, 'wrapped train starts behind the portrait block');
  assert.ok(lastTail.x > 44, 'every coach has cleared the short guideway before wrapping');
});

test('curved railway clears the saved buildings and pier rectangles match each local tangent', () => {
  const footprints = railPierFootprints();
  const supports=railSupportPoses();
  assert.equal(footprints.length, supports.length);
  for (let index = 0; index < footprints.length; index++) {
    const rect = footprints[index];
    const route = supports[index];
    const rotation = new T.Matrix4().makeRotationY(route.yaw);
    for (const x of [-1.425, 1.425]) for (const z of [-1.5, 1.5]) {
      const corner = new T.Vector3(x, 0, z).applyMatrix4(rotation);
      corner.x += route.x;
      corner.z += route.z;
      assert.ok(Math.abs(corner.x - rect.x) <= rect.w / 2 + 1e-10);
      assert.ok(Math.abs(corner.z - rect.z) <= rect.d / 2 + 1e-10);
    }
  }
  // Current owner map: base-with-wallet-tower-saved-2026-09-18.json.
  // Keep the compact route behind both advertising towers.
  const tallBuildings = [
    { name: 'media tower', x: -11, z: -19, w: 8.96, d: 7.98 },
    { name: 'wallet tower', x: 7.3151, z: -18.769195014829442, w: 8.2, d: 7.64 },
    { name: 'neon residence', x: -20.5199, z: -11.9723, w: 12.112, d: 10.92 },
  ];
  const deckMin = Math.min(...ELEVATED_RAIL.deckCentres) - ELEVATED_RAIL.deckLength / 2;
  const deckMax = Math.max(...ELEVATED_RAIL.deckCentres) + ELEVATED_RAIL.deckLength / 2;
  for (let distance = deckMin; distance <= deckMax; distance += .2) {
    const point = sampleRailRoute(distance);
    for (const building of tallBuildings) {
      const dx = Math.max(0, Math.abs(point.x - building.x) - building.w / 2);
      const dz = Math.max(0, Math.abs(point.z - building.z) - building.d / 2);
      assert.ok(Math.hypot(dx, dz) > 2.3, `complete deck clears ${building.name}`);
    }
  }
  const allBuildings = [...tallBuildings,
    { name: 'administration', x: 12.3706, z: -10.0715, w: 13.3, d: 8 },
    { name: 'armory', x: -9.5747, z: -9.8703, w: 9.22, d: 7.52 },
    { name: 'courtyard', x: .0838, z: -10.4924, w: 10, d: 8 },
    // Actual buildMetro envelope includes the stairs/tactile paving (~7.4 x 6.5m).
    { name: 'metro', x: 24.5, z: -11.5787, w: 7.4, d: 6.5 },
  ];
  for (const pier of footprints) for (const building of allBuildings) {
    const separateX = Math.abs(pier.x - building.x) > (pier.w + building.w) / 2 + .35;
    const separateZ = Math.abs(pier.z - building.z) > (pier.d + building.d) / 2 + .35;
    assert.ok(separateX || separateZ, `support foot clears ${building.name}`);
  }
  const right = footprints.at(-1);
  assert.ok(footprints[3].x > 35 && footprints[3].z < -19, 'original metro support is unchanged');
  assert.ok(right.x > 55 && right.z > 45, 'new supports stand outside the east fence on the earth shoulder');
});

test('curved deck stays batched, coaches articulate, and generated resources dispose once', async () => {
  const model = fixture();
  const scene = new T.Scene();
  const atlas = new T.Texture();
  const errors = [];
  let complete = 0;
  const originalCounts = countDisposals([...model.resources, atlas]);
  const rail = createElevatedRail(scene, { loadAsync: async () => model }, false,
    message => errors.push(message), () => complete++, async () => atlas);
  await rail.ready;
  assert.deepEqual(errors, []);
  assert.equal(complete, 1);
  assert.equal(rail.root.rotation.y, ELEVATED_RAIL.trackYaw);
  assert.equal(rail.root.position.z, ELEVATED_RAIL.z);
  const instances = [];
  rail.root.traverse(object => { if (object.isInstancedMesh && /^(RailPier|TrainCar|TrainMiddle)/.test(object.name)) instances.push(object); });
  assert.equal(instances.length, 3, 'supports and both car types retain instanced draws');
  assert.deepEqual(instances.map(mesh => mesh.count).sort((a, b) => a - b),
    [1, 2, railSupportPoses().length].sort((a, b) => a - b));
  const pier = instances.find(mesh => mesh.name.startsWith('RailPier'));
  const deck = rail.root.children.find(mesh => mesh.name.startsWith('RailDeck'));
  assert.ok(deck.isMesh && !deck.isInstancedMesh, 'one bent deck mesh instead of disconnected straight spans');
  rail.root.updateMatrixWorld(true);
  const pierMatrix = new T.Matrix4();
  const footprints = railPierFootprints();
  for (let index = 0; index < pier.count; index++) {
    pier.getMatrixAt(index, pierMatrix);
    pierMatrix.premultiply(pier.matrixWorld);
    assert.ok(Math.abs(pierMatrix.elements[12] - footprints[index].x) < 1e-5);
    assert.ok(Math.abs(pierMatrix.elements[14] - footprints[index].z) < 1e-5);
  }
  assert.equal(pier.material, deck.material);
  assert.equal(pier.material.map, atlas);
  assert.equal(pier.material.bumpMap, atlas);
  assert.ok(pier.geometry.attributes.concreteSurface);
  assert.ok(Math.abs(pier.geometry.boundingBox.min.y) < 1e-5, 'shortened supports remain grounded');
  assert.ok(Math.abs(pier.geometry.boundingBox.max.y - (ELEVATED_RAIL.deckY - 1.1)) < 1e-5,
    'shortened supports meet the lowered deck underside');
  const maxPierUv = Math.max(...pier.geometry.attributes.uv.array);
  assert.ok(maxPierUv > 4 && maxPierUv < 5, 'shortened pier concrete still repeats by metres');
  const cab = instances.find(mesh => mesh.name.startsWith('TrainCar'));
  const rearMatrix = new T.Matrix4(), leadMatrix = new T.Matrix4();
  cab.getMatrixAt(0, leadMatrix);
  cab.getMatrixAt(1, rearMatrix);
  const forward = new T.Vector3(1, 0, 0).transformDirection(rearMatrix);
  const rearPose = sampleRailRoute(ELEVATED_RAIL.initialX - ELEVATED_RAIL.carSpacing * 2);
  assert.ok(forward.dot(new T.Vector3(Math.cos(rearPose.yaw), 0, -Math.sin(rearPose.yaw))) < -.99,
    'rear cab faces backwards along its own section of the curve');
  const leadForward = new T.Vector3(1, 0, 0).transformDirection(leadMatrix);
  assert.ok(Math.abs(leadForward.dot(forward)) < .99, 'coaches articulate through the small tower-side bend');
  const initial = leadMatrix.clone();
  assert.equal(rail.update(1, false), true);
  cab.getMatrixAt(0, leadMatrix);
  const expected = sampleRailRoute(ELEVATED_RAIL.initialX + ELEVATED_RAIL.speed);
  assert.ok(Math.hypot(leadMatrix.elements[12] - expected.x, leadMatrix.elements[14] - expected.z) < .2,
    'lead coach follows the track at constant route speed within its bogie-chord offset');
  assert.equal(rail.update(1, true), true);
  cab.getMatrixAt(0, leadMatrix);
  assert.deepEqual(leadMatrix.elements, initial.elements, 'reduced motion restores the selected composition');
  assert.equal(rail.update(100, true), false);
  const generatedCounts = countDisposals([
    ...instances, ...instances.map(mesh => mesh.geometry), deck.geometry, pier.material,
  ]);
  rail.dispose();
  rail.dispose();
  assert.equal(scene.children.length, 0);
  assert.ok(originalCounts.every(count => count === 1));
  assert.ok(generatedCounts.every(count => count === 1));
  assert.equal(rail.update(1, false), false);
});

test('late model and atlas loads never resurrect a disposed railway or report errors', async () => {
  for (const pendingStage of ['model', 'atlas']) {
    const model = fixture();
    const atlas = new T.Texture();
    const resources = pendingStage === 'model' ? model.resources : [...model.resources, atlas];
    const counts = countDisposals(resources);
    const scene = new T.Scene();
    let resolve;
    let atlasLoads = 0;
    const errors = [];
    let complete = 0;
    const rail = createElevatedRail(scene,
      { loadAsync: () => pendingStage === 'model' ? new Promise(done => { resolve = done; }) : Promise.resolve(model) },
      true, message => errors.push(message), () => complete++, () => {
        atlasLoads++;
        return new Promise(done => { resolve = done; });
      });
    await new Promise(setImmediate);
    rail.dispose();
    resolve(pendingStage === 'model' ? model : atlas);
    await rail.ready;
    assert.equal(scene.children.length, 0);
    assert.equal(atlasLoads, pendingStage === 'model' ? 0 : 1);
    assert.equal(complete, 0);
    assert.deepEqual(errors, []);
    assert.ok(counts.every(count => count === 1));
  }
});

test('asset errors release partial resources and resolve readiness so Base loading can continue', async () => {
  for (const failure of ['module', 'atlas']) {
    const model = fixture();
    if (failure === 'module') model.scene.children.find(child => child.name === 'TrainMiddle').name = 'WrongName';
    const counts = countDisposals(model.resources);
    const scene = new T.Scene();
    const errors = [];
    let complete = 0;
    const rail = createElevatedRail(scene, { loadAsync: async () => model }, false,
      message => errors.push(message), () => complete++, async () => { throw new Error('offline'); });
    await rail.ready;
    assert.equal(errors.length, 1);
    assert.match(errors[0], /The refuge remains playable/);
    assert.equal(complete, 1);
    assert.equal(scene.children.length, 0);
    assert.ok(counts.every(count => count === 1));
    rail.dispose();
    assert.ok(counts.every(count => count === 1));
  }
});
