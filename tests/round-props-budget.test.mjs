import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import * as T from 'three';

// Procedural asset generation needs texture/canvas handles, not a browser or GPU.
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(specifier + '.ts', context.parentURL);
    if (existsSync(url)) return next(url.href, context);
  }
  return next(specifier, context);
} });
const canvasContext = new Proxy({
  measureText: () => ({ width: 100 }),
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }),
}, { get: (object, key) => object[key] ?? (() => {}) });
globalThis.document = { createElement: () => ({ width: 512, height: 512, getContext: () => canvasContext }) };
T.TextureLoader.prototype.load = function () { return new T.Texture(); };
const { createPropLibrary } = await import('../components/expedition/prop-assets.ts');
const { createMicrobus } = await import('../components/expedition/microbus.ts');
const baseline = JSON.parse(readFileSync(new URL('./fixtures/round-props-before.json', import.meta.url), 'utf8'));

function inspect(root) {
  let triangles = 0, geometryBytes = 0, draws = 0;
  const materials = [], geometries = new Set();
  root.traverse(object => {
    if (!object.isMesh) return;
    const geometry = object.geometry;
    triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3 * (object.isInstancedMesh ? object.count : 1);
    draws++;
    if (!geometries.has(geometry)) {
      geometries.add(geometry);
      geometryBytes += geometry.index?.array.byteLength ?? 0;
      for (const attribute of Object.values(geometry.attributes)) {
        geometryBytes += attribute.array.byteLength;
        assert.ok(Array.from(attribute.array).every(Number.isFinite), 'finite mesh attributes');
      }
    }
    assert.ok(geometry.attributes.uv && geometry.attributes.normal, 'textures and smooth normals remain');
    const normal = geometry.attributes.normal;
    for (let vertex = 0; vertex < normal.count; vertex++) {
      const length = Math.hypot(normal.getX(vertex), normal.getY(vertex), normal.getZ(vertex));
      assert.ok(Math.abs(length - 1) < .001, 'surface normals are normalized after batching');
    }
    for (const index of geometry.index.array) assert.ok(index < geometry.attributes.position.count);
    const material = object.material;
    materials.push({ type: material.type, color: material.color?.getHex(), roughness: material.roughness,
      metalness: material.metalness, transparent: material.transparent, opacity: material.opacity, map: !!material.map });
  });
  return { triangles, geometryBytes, draws, size: new T.Box3().setFromObject(root).getSize(new T.Vector3()).toArray(), materials };
}

test('small round props retain their dimensions, materials and valid smooth surfaces within lower budgets', () => {
  const library = createPropLibrary();
  const scene = new T.Scene();
  const microbus = createMicrobus(scene, 0, 4);
  try {
    const models = { tires: library.create('tires'), hydrant: library.create('hydrant'), microbus: scene };
    const budget = { tires: .75, hydrant: .78, microbus: .94 };
    for (const [id, model] of Object.entries(models)) {
      const current = inspect(model), before = baseline[id];
      assert.ok(current.triangles <= before.triangles * budget[id], `${id}: meaningful triangle reduction (${current.triangles})`);
      assert.ok(current.geometryBytes < before.geometryBytes, `${id}: smaller vertex/index buffers`);
      assert.equal(current.draws, before.draws, `${id}: no new material draw calls`);
      assert.deepEqual(current.materials, before.materials, `${id}: all materials and glazing preserved`);
      for (let axis = 0; axis < 3; axis++) {
        assert.ok(Math.abs(current.size[axis] - before.size[axis]) < .015, `${id}: bounds within 1.5 cm on axis ${axis}`);
      }
    }
  } finally {
    microbus.dispose();
    library.dispose();
  }
});
