import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import * as T from 'three';
import { createMetroOpening, bindMetroOpening } from '../src/renderer/environment/metro-opening.ts';
import { createEditableRender } from '../components/base/editable-render.ts';

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(specifier + '.ts', context.parentURL);
    if (existsSync(url)) return next(url.href, context);
  }
  return next(specifier, context);
} });
const { buildMetro, courtyardFloorGeometry } = await import('../components/base/metro.ts');
const { createWetFloor } = await import('../components/base/wet-floor.ts');
const { buildRefugeZones } = await import('../components/base/zones.ts');

const clipped = (material, point) => material.clippingPlanes?.every(plane => plane.distanceToPoint(point) < 0) ?? false;

test('the existing stairs and landing become visible through both slab layers and paving', () => {
  const opening = createMetroOpening(), scene = new T.Scene();
  const original = new T.MeshStandardMaterial(), cut = opening.material(original);
  const floor = new T.Mesh(courtyardFloorGeometry(), cut);
  floor.rotation.x = -Math.PI / 2; floor.position.y = .075; scene.add(floor);
  for (const [y, height] of [[-.11, .22], [-.68, 1.3]]) {
    const slab = new T.Mesh(new T.BoxGeometry(64, height, 54), cut);
    slab.position.set(0, y, -15); scene.add(slab);
  }
  const tools = {
    box(x, y, z, w, h, d, material) {
      const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z); scene.add(mesh);
    },
    pipe() {}, sign() {}, light() {}, cylinder() {}, surface: material => material,
    m: new Proxy({}, { get: () => original }),
  };
  buildMetro(tools);
  buildRefugeZones({ ...tools, groundMaterial: opening.apply });
  scene.updateMatrixWorld(true);
  const ray = new T.Raycaster();
  const visibleHeight = (x, z) => {
    ray.set(new T.Vector3(x, 4, z), new T.Vector3(0, -1, 0));
    return ray.intersectObjects(scene.children).find(hit => !clipped(hit.object.material, hit.point))?.point.y;
  };
  assert.ok(visibleHeight(7.15, -7.3) < -.7, 'actual descending tread, not the former flat lid');
  assert.ok(visibleHeight(7.15, -9.6) < -2.3, 'landing is more than two metres below paving');
  assert.ok(visibleHeight(10.3, -6.2) > .07, 'ticket-side deck remains solid');
  assert.ok(Math.abs(visibleHeight(3, -7) - .075) < 1e-6, 'surrounding courtyard stays intact');
  const materials = new Set();
  scene.traverse(object => { if (object.isMesh) { object.geometry.dispose(); materials.add(object.material); } });
  materials.forEach(material => material.dispose());
});

test('portal follows editor recentering, translation, rotation and scale without accumulating errors', () => {
  const scene = new T.Scene();
  const source = new T.Mesh(new T.BoxGeometry(7.4, 4.8, 6.3), new T.MeshStandardMaterial());
  source.position.set(8.5, -.44, -7.8); scene.add(source);
  const render = createEditableRender(scene, [source], [source],
    new Map([[source, { id: 'base:metro', name: 'Metro' }]]), new Map());
  const object = render.authored[0].object;
  const originalMatrix = object.matrixWorld.clone();
  const opening = createMetroOpening(), material = opening.apply(new T.MeshStandardMaterial());
  const update = bindMetroOpening(object, opening.update);
  const inside = new T.Vector3(7, 0, -8), outside = new T.Vector3(4, 0, -8);
  for (const yaw of [-Math.PI * 2, Math.PI / 3, Math.PI]) {
    object.position.set(25.25, -2.59, -11.5787);
    object.rotation.y = yaw; object.scale.set(1.2, .8, .7); update(false);
    const delta = object.matrixWorld.clone().multiply(originalMatrix.clone().invert());
    assert.ok(clipped(material, inside.clone().applyMatrix4(delta)));
    assert.ok(!clipped(material, outside.clone().applyMatrix4(delta)));
    assert.ok(!clipped(material, inside), 'old courtyard opening is sealed after relocation');
    const values = opening.planes.map(plane => [...plane.normal.toArray(), plane.constant]);
    render.setActive(false); render.setActive(true); update(false);
    assert.deepEqual(opening.planes.map(plane => [...plane.normal.toArray(), plane.constant]), values);
    update(true);
    assert.ok(!clipped(material, inside.clone().applyMatrix4(delta)), 'deletion seals the hole');
    update(false);
    assert.ok(clipped(material, inside.clone().applyMatrix4(delta)), 'undo restores the hole');
  }
  object.matrix.copy(originalMatrix).decompose(object.position, object.quaternion, object.scale);
  update(false);
  assert.ok(clipped(material, inside), 'reset restores the authored entrance');
  render.dispose(); source.geometry.dispose(); source.material.dispose(); material.dispose();
});

test('ground material copies retain scan shaders/textures and share live clipping planes with reflections', () => {
  const opening = createMetroOpening(), texture = new T.Texture();
  const source = new T.MeshStandardMaterial({ map: texture });
  source.onBeforeCompile = shader => { shader.uniforms.scan = { value: 3 }; };
  source.customProgramCacheKey = () => 'metric-stone';
  const copy = opening.material(source);
  assert.notEqual(copy, source);
  assert.equal(copy, opening.material(source));
  assert.equal(source.clippingPlanes, null);
  assert.equal(copy.map, texture);
  assert.equal(copy.onBeforeCompile, source.onBeforeCompile);
  assert.equal(copy.customProgramCacheKey(), 'metric-stone');
  assert.ok(copy.clipIntersection && copy.clipShadows);
  const floor = createWetFloor(false, opening);
  assert.equal(floor.material.clippingPlanes, copy.clippingPlanes);
  assert.ok(floor.material.clipping);
  assert.match(floor.material.vertexShader, /clipping_planes_vertex/);
  assert.match(floor.material.fragmentShader, /clipping_planes_fragment/);
  assert.match(floor.material.fragmentShader, /refugeWetness/, 'existing wet-floor appearance is retained');
  opening.update(new T.Matrix4().makeTranslation(17, 0, -4), true);
  assert.ok(clipped(copy, new T.Vector3(24, 0, -12)));
  assert.ok(clipped(floor.material, new T.Vector3(24, 0, -12)));
  floor.dispose(); floor.geometry.dispose(); copy.dispose(); source.dispose(); texture.dispose();
});
