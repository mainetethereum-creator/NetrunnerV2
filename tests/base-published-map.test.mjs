import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BASE_PUBLISHED_LAYOUT } from '../src/assets/base-published-layout.ts';
import { REFERENCE_BUILDINGS } from '../src/assets/reference-buildings.ts';
import { createMetroOpening } from '../src/renderer/environment/metro-opening.ts';
import { clearBaseEditor } from '../components/base/world.ts';

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(specifier + '.ts', context.parentURL);
    if (existsSync(url)) return next(url.href, context);
  }
  return next(specifier, context);
} });
const context = new Proxy({ measureText: () => ({ width: 100 }), createLinearGradient: () => ({ addColorStop() {} }) }, { get: (target, key) => target[key] ?? (() => {}) });
globalThis.document = { createElement: () => ({ width: 512, height: 512, getContext: () => context }) };
T.TextureLoader.prototype.load = () => new T.Texture();
GLTFLoader.prototype.loadAsync = async () => ({ scene: new T.Group().add(new T.Mesh(new T.BoxGeometry(2, 2, 2).translate(0, 1, 0), new T.MeshStandardMaterial())) });
const { createPublishedMap, preparePublishedReferences } = await import('../components/base/published-map.ts');
const { createPropLibrary } = await import('../components/expedition/prop-assets.ts');

test('release data exactly matches the latest owner export, including deletions', () => {
  assert.deepEqual(BASE_PUBLISHED_LAYOUT, JSON.parse(readFileSync('output/map-backups/base-published-2026-09-19.json', 'utf8')));
  assert.equal(BASE_PUBLISHED_LAYOUT.entries.length, 40);
});

test('fresh production restores saved transforms, NPCs, building collisions and shared resource ownership without storage', async () => {
  const scene = new T.Scene(), labels = new Map(), sources = [], npcs = [];
  const updated = new Map();
  for (const entry of BASE_PUBLISHED_LAYOUT.entries.filter(e => e.id === e.source)) {
    const object = new T.Group().add(new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial()));
    scene.add(object);
    if (entry.id.startsWith('npc:')) npcs.push({ id: entry.id, object, onTransform: e => updated.set(e.id, e) });
    else { sources.push(object); labels.set(object, { id: entry.id, name: entry.id }); }
  }
  let rects, floorVisible;
  const map = createPublishedMap({ scene, sources, rendered: [...sources], labels, instanceLabels: new Map(), npcs,
    onColliders: value => { rects = value; }, onFloorVisibility: value => { floorVisible = value; },
    onMetroTransform: createMetroOpening().update, onAssetsChanged() {},
  });
  await map.ready;
  assert.equal(floorVisible, true);
  assert.ok(rects.length >= 10, 'placed buildings obstruct movement');
  for (const npc of npcs) {
    const entry = BASE_PUBLISHED_LAYOUT.entries.find(e => e.id === npc.id);
    assert.equal(npc.object.visible, !entry.deleted);
    assert.deepEqual(npc.object.position.toArray(), [entry.x, entry.y, entry.z]);
    assert.equal(updated.get(npc.id), entry);
  }
  const corner = BASE_PUBLISHED_LAYOUT.entries.find(e => e.source === 'building-corner-chamfer');
  const placed = scene.children.find(o => o.position.x === corner.x && o.position.z === corner.z);
  assert.ok(placed);
  assert.deepEqual(placed.scale.toArray(), [corner.sx, corner.sy, corner.sz]);
  let disposals = 0;
  placed.children[0].geometry.addEventListener('dispose', () => disposals++);
  map.dispose(); map.dispose(); clearBaseEditor();
  assert.equal(disposals, 1);
  assert.equal(placed.parent, null);
  for (const source of sources) assert.equal(source.parent, scene);
});

test('published map and prop catalogue borrow one reference library without disposing it', async () => {
  const scene = new T.Scene();
  const sources = [], labels = new Map(), npcs = [];
  for (const entry of BASE_PUBLISHED_LAYOUT.entries.filter(e => e.id === e.source)) {
    const object = new T.Group().add(new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial()));
    scene.add(object);
    if (entry.id.startsWith('npc:')) npcs.push({ id: entry.id, object, onTransform() {} });
    else { sources.push(object); labels.set(object, { id: entry.id, name: entry.id }); }
  }
  const sharedGeometry = new T.BoxGeometry(2, 2, 2).translate(0, 1, 0);
  const sharedMaterial = new T.MeshStandardMaterial();
  const calls = { prepare: 0, create: 0, dispose: 0 };
  const references = {
    async prepare() { calls.prepare++; }, isReady() { return true; },
    create(id) { calls.create++; const root = new T.Group().add(new T.Mesh(sharedGeometry, sharedMaterial)); root.userData.source = id; return root; },
    dispose() { calls.dispose++; sharedGeometry.dispose(); sharedMaterial.dispose(); },
  };
  const props = createPropLibrary(4, undefined, true, references);
  await props.prepare('building-corner-chamfer');
  const map = createPublishedMap({ scene, sources, rendered: [...sources], labels,
    instanceLabels: new Map(), npcs, referenceLibrary: references,
    onColliders() {}, onFloorVisibility() {}, onMetroTransform() {}, onAssetsChanged() {},
  });
  await map.ready;
  assert.ok(calls.prepare > 1);
  assert.ok(calls.create > 0);
  assert.deepEqual(scene.children.filter(object => object.userData.source).map(object => object.userData.source),
    BASE_PUBLISHED_LAYOUT.entries.filter(entry => !entry.deleted && REFERENCE_BUILDINGS.some(asset => asset.id === entry.source))
      .map(entry => entry.source));
  props.dispose(); map.dispose();
  assert.equal(calls.dispose, 0, 'borrowers leave shared geometry and materials alive');
  const extra = references.create();
  assert.equal(extra.children[0].geometry, sharedGeometry);
  references.dispose();
  assert.equal(calls.dispose, 1);
});

test('reference preparation deduplicates IDs and keeps at most two decodes in flight', async () => {
  const ids = ['building-japanese-cafe', 'building-glass-corner', 'building-japanese-cafe',
    'building-wallet-tower', 'building-cyberbase-tower'];
  const started = [], pending = new Map();
  let inFlight = 0, peak = 0;
  const done = preparePublishedReferences(ids, { prepare(id) {
    started.push(id); inFlight++; peak = Math.max(peak, inFlight);
    return new Promise(resolve => pending.set(id, () => { inFlight--; resolve(); }));
  } }, 2, () => false);
  assert.deepEqual(started, ids.slice(0, 2));
  pending.get('building-glass-corner')(); await new Promise(setImmediate);
  assert.deepEqual(started, ['building-japanese-cafe', 'building-glass-corner', 'building-wallet-tower']);
  for (const id of ['building-japanese-cafe', 'building-wallet-tower', 'building-cyberbase-tower']) {
    pending.get(id)(); await new Promise(setImmediate);
  }
  await done;
  assert.equal(peak, 2);
  assert.deepEqual(started, ['building-japanese-cafe', 'building-glass-corner',
    'building-wallet-tower', 'building-cyberbase-tower']);
});

test('failed preparation waits for the other active request and launches no further work', async () => {
  const started = [], pending = new Map();
  const done = preparePublishedReferences(['building-japanese-cafe', 'building-glass-corner', 'building-wallet-tower'],
    { prepare(id) { started.push(id); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })); } },
    2, () => false);
  const failure = new Error('decode failed');
  pending.get('building-japanese-cafe').reject(failure);
  await new Promise(setImmediate);
  assert.deepEqual(started, ['building-japanese-cafe', 'building-glass-corner']);
  pending.get('building-glass-corner').resolve();
  await assert.rejects(done, error => error === failure);
  assert.deepEqual(started, ['building-japanese-cafe', 'building-glass-corner']);
});
