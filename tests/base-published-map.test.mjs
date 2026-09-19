import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BASE_PUBLISHED_LAYOUT } from '../src/assets/base-published-layout.ts';
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
const { createPublishedMap } = await import('../components/base/published-map.ts');

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
