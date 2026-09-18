import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createEditableRender} from '../components/base/editable-render.ts';

function matrixValues(matrix) {
  return matrix.elements.map((value) => Math.round(value * 1e10) / 1e10);
}

function visibleMeshes(scene) {
  const meshes = [];
  scene.traverseVisible((object) => {
    if (object instanceof T.Mesh) meshes.push(object);
  });
  return meshes;
}

test('editable groups preserve visual matrices and are recentered at their bottom-center', () => {
  const scene = new T.Scene();
  const material = new T.MeshStandardMaterial({color: 0x778899});
  const first = new T.Mesh(new T.BoxGeometry(2, 4, 2), material);
  const second = new T.Mesh(new T.BoxGeometry(2, 2, 2), material);
  first.position.set(4, 3, -2);
  second.position.set(8, 2, -2);
  scene.add(first, second);
  scene.updateMatrixWorld(true);
  const before = [first.matrixWorld.clone(), second.matrixWorld.clone()];
  const labels = new Map([
    [first, {id: 'stall:a', name: 'Stall'}],
    [second, {id: 'stall:a', name: 'Stall'}],
  ]);

  const render = createEditableRender(scene, [first, second], [], labels, new Map());
  render.setActive(true);
  scene.updateMatrixWorld(true);

  assert.equal(render.authored.length, 1);
  assert.strictEqual(render.templates.get('stall:a'), render.authored[0].object);
  assert.deepEqual(matrixValues(first.matrixWorld), matrixValues(before[0]));
  assert.deepEqual(matrixValues(second.matrixWorld), matrixValues(before[1]));
  assert.deepEqual(render.authored[0].object.position.toArray(), [6, 1, -2]);

  render.authored[0].object.position.x += 3;
  scene.updateMatrixWorld(true);
  assert.equal(Math.round(first.getWorldPosition(new T.Vector3()).x), 7);
  render.dispose();
  first.geometry.dispose();
  second.geometry.dispose();
  material.dispose();
});

test('instance subsets keep matrices, colors and instanced shader semantics', () => {
  const scene = new T.Scene();
  const geometry = new T.BoxGeometry(1, 1, 1);
  const material = new T.MeshStandardMaterial({color: 0x808080});
  const source = new T.InstancedMesh(geometry, material, 2);
  source.position.set(2, 0, 3);
  source.setMatrixAt(0, new T.Matrix4().makeTranslation(1, 0.5, 0));
  source.setMatrixAt(1, new T.Matrix4().makeTranslation(5, 0.5, 0));
  source.setColorAt(0, new T.Color(1, 0, 0));
  source.setColorAt(1, new T.Color(0, 1, 0));
  scene.add(source);
  scene.updateMatrixWorld(true);
  const instanceMatrix = new T.Matrix4();
  const instanceColor = new T.Color();
  const expected = [0, 1].map((index) => {
    source.getMatrixAt(index, instanceMatrix);
    return new T.Matrix4().multiplyMatrices(source.matrixWorld, instanceMatrix);
  });

  const render = createEditableRender(scene, [source], [], new Map(), new Map([[source, [
    {id: 'crate:0', name: 'Red crate'},
    {id: 'crate:1', name: 'Green crate'},
  ]]]));
  render.setActive(true);
  scene.updateMatrixWorld(true);

  const meshes = render.authored.map((item) => item.object.children[0]);
  assert.ok(meshes.every((mesh) => mesh instanceof T.InstancedMesh));
  meshes.forEach((mesh, index) => {
    mesh.getMatrixAt(0, instanceMatrix);
    const actual = new T.Matrix4().multiplyMatrices(mesh.matrixWorld, instanceMatrix);
    assert.deepEqual(matrixValues(actual), matrixValues(expected[index]));
  });
  meshes[0].getColorAt(0, instanceColor);
  assert.deepEqual(instanceColor.toArray(), new T.Color(1, 0, 0).toArray());
  meshes[1].getColorAt(0, instanceColor);
  assert.deepEqual(instanceColor.toArray(), new T.Color(0, 1, 0).toArray());
  assert.strictEqual(meshes[0].geometry, geometry);

  render.setActive(false);
  const proxy = visibleMeshes(scene).find((object) => object instanceof T.InstancedMesh);
  assert.equal(proxy.count, 2, 'logical subsets merge back into one gameplay draw');
  assert.ok(proxy.instanceColor);

  render.dispose();
  assert.strictEqual(source.parent, scene);
  geometry.dispose();
  material.dispose();
});

test('inactive rendering batches opaque meshes and follows delete/undo visibility', () => {
  const scene = new T.Scene();
  const geometry = new T.BoxGeometry(1, 1, 1);
  const material = new T.MeshStandardMaterial();
  const originalRender = new T.Mesh(geometry, material);
  const objects = [0, 1, 2].map((x) => {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.x = x * 2;
    scene.add(mesh);
    return mesh;
  });
  scene.add(originalRender);
  const labels = new Map(objects.map((object, index) => [object, {id: `box:${index}`, name: `Box ${index}`} ]));
  const render = createEditableRender(scene, objects, [originalRender], labels, new Map());

  assert.equal(originalRender.visible, false);
  let batches = visibleMeshes(scene).filter((object) => object instanceof T.InstancedMesh);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].count, 3);

  render.setActive(true);
  assert.equal(visibleMeshes(scene).filter((object) => object instanceof T.InstancedMesh).length, 0);
  assert.equal(visibleMeshes(scene).length, 3);

  render.authored[1].object.visible = false;
  render.setActive(false);
  batches = visibleMeshes(scene).filter((object) => object instanceof T.InstancedMesh);
  assert.equal(batches[0].count, 2, 'deleted group is absent from the gameplay batch');

  render.setActive(true);
  render.authored[1].object.visible = true;
  render.setActive(false);
  batches = visibleMeshes(scene).filter((object) => object instanceof T.InstancedMesh);
  assert.equal(batches[0].count, 3, 'undo restores the object to the gameplay batch');

  render.dispose();
  geometry.dispose();
  material.dispose();
});

test('lights stay active through independent proxies and disposal never owns shared resources', () => {
  const scene = new T.Scene();
  const geometry = new T.BoxGeometry();
  const material = new T.MeshStandardMaterial({transparent: true, opacity: 0.5});
  const source = new T.Group();
  const mesh = new T.Mesh(geometry, material);
  const light = new T.PointLight(0xffaa00, 2, 8);
  source.add(mesh, light);
  scene.add(source);
  let geometryDisposals = 0;
  let materialDisposals = 0;
  geometry.addEventListener('dispose', () => geometryDisposals++);
  material.addEventListener('dispose', () => materialDisposals++);

  const render = createEditableRender(
    scene,
    [source],
    [],
    new Map([[source, {id: 'lamp', name: 'Lamp'}]]),
    new Map(),
  );
  assert.equal(scene.children.some((object) => object instanceof T.PointLight), false);
  let proxyLights = [];
  scene.traverseVisible((object) => {
    if (object instanceof T.PointLight) proxyLights.push(object);
  });
  assert.equal(proxyLights.length, 1);
  assert.notStrictEqual(proxyLights[0], light);

  render.refresh();
  render.dispose();
  assert.equal(geometryDisposals, 0);
  assert.equal(materialDisposals, 0);
  assert.strictEqual(source.parent, scene);
  assert.strictEqual(mesh.geometry, geometry);
  assert.strictEqual(mesh.material, material);

  geometry.dispose();
  material.dispose();
});
