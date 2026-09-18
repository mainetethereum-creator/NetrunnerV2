import { registerHooks } from 'node:module';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as T from 'three';

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/i.test(specifier)) {
    for (const extension of ['.ts', '.tsx']) {
      const url = new URL(specifier + extension, context.parentURL);
      if (existsSync(url)) return next(url.href, context);
    }
  }
  return next(specifier, context);
} });

// CPU-only fixture: no DOM, GPU, network, preview, or game process is started.
const context = new Proxy({ measureText: () => ({ width: 100 }),
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }) },
{ get: (target, key) => target[key] ?? (() => {}) });
globalThis.document ??= { createElement: () => ({ width: 512, height: 512, getContext: () => context }) };
globalThis.localStorage ??= { getItem: () => null, setItem() {} };
T.TextureLoader.prototype.load = function () { return new T.Texture(); };
const frames = new Map();
let handle = 0, clock = 0;
globalThis.requestAnimationFrame = callback => { frames.set(++handle, callback); return handle; };
globalThis.cancelAnimationFrame = id => frames.delete(id);
export function drainEditorFrames() {
  for (let turn = 0; turn < 20 && frames.size; turn++) {
    clock += 100;
    const pending = [...frames.values()]; frames.clear();
    for (const callback of pending) callback(clock);
  }
  if (frames.size) throw new Error('Editor fixture did not settle within 20 frames');
}
const { createWorldEditor } = await import('../components/world-editor/controller.ts');

export function fixtureEntry(id, source, patch = {}) {
  return { id, source, x: 0, y: 0, z: 0, rx: 0, rotation: 0, rz: 0, sx: 1, sy: 1, sz: 1, ...patch };
}

export async function createEditorBenchmarkFixture({ groups = 120, meshes = 80, dynamic = 40, includePropAssets = false } = {}) {
  const scene = new T.Scene();
  const geometry = new T.BoxGeometry(.35, 1, .35).translate(0, .5, 0);
  const shortGeometry = new T.BoxGeometry(2, 2, 3).translate(0, 1, 0);
  const longGeometry = new T.BoxGeometry(7, 2, 3).translate(0, 1, 0);
  const material = new T.MeshBasicMaterial();
  const roots = [], changes = Array(groups).fill(0), rootUpdates = Array(groups).fill(0), visits = Array(groups).fill(0);
  const authored = Array.from({ length: groups }, (_, index) => {
    const object = new T.Group(); roots.push(object);
    object.position.set(index % 12 * 8, 0, Math.floor(index / 12) * 8);
    const update = object.updateMatrixWorld;
    object.updateMatrixWorld = function (...args) { rootUpdates[index]++; return update.apply(this, args); };
    for (let child = 0; child < meshes; child++) {
      const mesh = new T.Mesh(geometry, material);
      mesh.position.set(child % 10 * .4, Math.floor(child / 40) * 1.1, Math.floor(child / 10) % 4 * .4);
      const world = mesh.updateWorldMatrix;
      mesh.updateWorldMatrix = function (...args) { visits[index]++; return world.apply(this, args); };
      object.add(mesh);
    }
    scene.add(object);
    return { id: `authored:${index}`, name: `Building ${index}`, object,
      collision: { w: 4, d: 2, h: 3 }, onTransform: () => changes[index]++ };
  });
  let dynamicPads = [], authoredPads = [];
  const editor = createWorldEditor(scene, () => {}, { map: 'base', anisotropy: 1, height: () => 0,
    authored, includePropAssets,
    additionalAssets: [
      { id: 'fixture:short', name: 'Short box', create: () => new T.Mesh(shortGeometry, material) },
      { id: 'fixture:long', name: 'Long box', create: () => new T.Mesh(longGeometry, material) },
    ],
    onColliders: value => { dynamicPads = value; },
    onAuthoredColliders: value => { authoredPads = value; },
  });
  await editor.ready;
  const entries = Array.from({ length: dynamic }, (_, index) =>
    fixtureEntry(`prop:${index}`, 'fixture:short', { x: index % 10 * 5, z: -10 - Math.floor(index / 10) * 5 }));
  if (entries.length) await editor.importJSON(JSON.stringify({ version: 1, map: 'base', entries }));
  editor.setActive(true); drainEditorFrames();
  editor.select('authored:0'); drainEditorFrames();
  function resetCounters() { changes.fill(0); rootUpdates.fill(0); visits.fill(0); }
  resetCounters();
  return { scene, editor, roots, changes, rootUpdates, visits, resetCounters,
    get dynamicPads() { return dynamicPads; }, get authoredPads() { return authoredPads; },
    dispose() { editor.dispose(); drainEditorFrames(); geometry.dispose(); shortGeometry.dispose(); longGeometry.dispose(); material.dispose(); },
  };
}

function summary(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return { medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.ceil(sorted.length * .95) - 1],
    meanMs: samples.reduce((sum, value) => sum + value, 0) / samples.length };
}

export async function benchmarkEditorNudge() {
  const fixture = await createEditorBenchmarkFixture();
  try {
    for (let step = 0; step < 5; step++) { fixture.editor.nudge(1); drainEditorFrames(); }
    fixture.resetCounters();
    const nudges = [], idle = [];
    for (let step = 0; step < 60; step++) {
      const start = performance.now(); fixture.editor.nudge(1); drainEditorFrames(); nudges.push(performance.now() - start);
    }
    const transformCalls = fixture.changes.reduce((sum, value) => sum + value, 0);
    const unrelatedTransformCalls = fixture.changes.slice(1).reduce((sum, value) => sum + value, 0);
    const unrelatedRootUpdates = fixture.rootUpdates.slice(1).reduce((sum, value) => sum + value, 0);
    fixture.resetCounters();
    for (let frame = 0; frame < 120; frame++) {
      const start = performance.now(); fixture.editor.stream({ x: 0, z: 0 }); idle.push(performance.now() - start);
    }
    return { node: process.version, timestamp: new Date().toISOString(),
      controllerSha256: createHash('sha256').update(readFileSync(new URL('../components/world-editor/controller.ts', import.meta.url))).digest('hex'),
      fixture: { authoredGroups: 120, meshesPerGroup: 80, dynamicProps: 40, nudges: 60, idleFrames: 120 },
      nudge: { ...summary(nudges), transformCalls, unrelatedTransformCalls, unrelatedRootUpdates },
      idle: { ...summary(idle), selectedMeshBoundsVisits: fixture.visits[0] },
      scope: 'CPU controller/transform/collider/selection work only; excludes browser rendering and shadow GPU cost',
    };
  } finally { fixture.dispose(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await benchmarkEditorNudge();
  if (process.argv[2]) {
    const output = resolve(process.argv[2]); mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  }
  console.log(JSON.stringify(result, null, 2));
}
