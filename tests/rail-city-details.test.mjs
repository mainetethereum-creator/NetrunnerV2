import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createRailCityDetails } from '../src/renderer/environment/rail-city-details.ts';
import { railPierFootprints } from '../src/renderer/environment/elevated-rail-layout.ts';

function inspect(mobile) {
  const parent = new T.Group();
  const details = createRailCityDetails(parent, mobile);
  const meshes = [], lights = [];
  parent.traverse(object => {
    if (object.isMesh) meshes.push(object);
    if (object.isLight) lights.push(object);
  });
  const triangles = meshes.reduce((sum, mesh) => sum + mesh.geometry.index.count / 3, 0);
  return { parent, details, meshes, lights, triangles };
}

test('city service details stay within six batches and keep mobile free of extra lights', () => {
  const desktop = inspect(false), mobile = inspect(true);
  try {
    for (const scene of [desktop, mobile]) {
      assert.equal(scene.meshes.length, 6);
      assert.ok(scene.triangles < 12000, `${scene.triangles} service triangles`);
      for (const mesh of scene.meshes) {
        assert.equal(mesh.castShadow, false, 'small service details do not add shadow submissions');
        assert.ok(!Array.isArray(mesh.material));
        for (const attribute of Object.values(mesh.geometry.attributes)) {
          assert.ok(Array.from(attribute.array).every(Number.isFinite), 'finite merged geometry');
        }
      }
      assert.ok(scene.lights.every(light => !light.castShadow));
    }
    assert.equal(desktop.lights.length, 2);
    assert.equal(mobile.lights.length, 0);
    assert.ok(mobile.triangles < desktop.triangles, 'mobile omits one cable strand');
  } finally { desktop.details.dispose(); mobile.details.dispose(); }
});

test('all low service geometry stays inside existing support footprints', () => {
  const scene = inspect(false), feet = railPierFootprints();
  let overheadVertices = 0, lowVertices = 0;
  try {
    for (const mesh of scene.meshes) {
      const position = mesh.geometry.attributes.position;
      for (let index = 0; index < position.count; index++) {
        const x = position.getX(index), y = position.getY(index), z = position.getZ(index);
        if (y >= 7) { overheadVertices++; continue; }
        lowVertices++;
        assert.ok(feet.some(foot => Math.abs(x - foot.x) <= foot.w / 2 + 1e-4
          && Math.abs(z - foot.z) <= foot.d / 2 + 1e-4),
        `service detail outside existing collision feet at ${x},${y},${z}`);
      }
    }
    assert.ok(lowVertices > 100, 'cabinet and support tags are included');
    assert.ok(overheadVertices > 1000, 'suspended services are included');
  } finally { scene.details.dispose(); }
});

test('details dispose only their own merged resources and tolerate repeated teardown', () => {
  const scene = inspect(false), foreign = new T.Group();
  scene.parent.add(foreign);
  const resources = [...scene.meshes.flatMap(mesh => [mesh.geometry, mesh.material]), ...scene.lights];
  const disposed = new Map(resources.map(resource => [resource, 0]));
  resources.forEach(resource => resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1)));
  scene.details.dispose();scene.details.dispose();
  assert.deepEqual(scene.parent.children, [foreign]);
  assert.ok([...disposed.values()].every(count => count === 1));
});
