import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createEditorBenchmarkFixture, drainEditorFrames, fixtureEntry } from '../scripts/benchmark-editor-nudge.mjs';

const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} vs ${expected}`);
const documentWith = entries => JSON.stringify({ version: 1, map: 'base', entries });
const bounds = pads => ({
  minX: Math.min(...pads.map(pad => pad.x - pad.w / 2)), maxX: Math.max(...pads.map(pad => pad.x + pad.w / 2)),
  minZ: Math.min(...pads.map(pad => pad.z - pad.d / 2)), maxZ: Math.max(...pads.map(pad => pad.z + pad.d / 2)),
});

test('nudging one building does not reapply or recursively update 119 unchanged building roots', async () => {
  const fixture = await createEditorBenchmarkFixture();
  try {
    fixture.editor.nudge(1); drainEditorFrames();
    assert.equal(fixture.changes[0], 1, 'selected authored object updates its transform callback once');
    assert.equal(fixture.changes.slice(1).reduce((sum, count) => sum + count, 0), 0,
      'unchanged objects must not reapply colliders, NPC overrides or other callbacks');
    assert.equal(fixture.rootUpdates.slice(1).reduce((sum, count) => sum + count, 0), 0,
      'nudge/collider refresh must not recursively force world matrices through unrelated roots');
    near(fixture.roots[0].position.x, .25, 'selected building moves immediately');
    near(fixture.roots[1].position.x, 8, 'neighbor transform remains unchanged');
  } finally { fixture.dispose(); }
});

test('streaming an idle selection does not traverse its static mesh bounds every frame', async () => {
  const fixture = await createEditorBenchmarkFixture({ groups: 2, meshes: 80, dynamic: 2 });
  try {
    fixture.editor.nudge(1); drainEditorFrames();
    fixture.resetCounters();
    for (let frame = 0; frame < 120; frame++) fixture.editor.stream({ x: 0, z: 0 });
    assert.equal(fixture.visits[0], 0, 'selection box updates on edits/selection, not idle stream ticks');
    const outline = fixture.scene.children.find(object => object instanceof T.BoxHelper);
    assert.ok(outline?.visible, 'optimization retains the visible selection outline');
  } finally { fixture.dispose(); }
});

test('cached authored collisions follow transform, deletion, undo and reset without ghost footprints', async () => {
  const fixture = await createEditorBenchmarkFixture({ groups: 2, meshes: 2, dynamic: 0 });
  try {
    const original = structuredClone(fixture.authoredPads);
    fixture.editor.change({ x: 12, z: -4, rotation: 90, sx: 2 }); drainEditorFrames();
    const moved = fixture.authoredPads.find(pad => Math.abs(pad.x - 12) < 1e-6);
    assert.ok(moved); near(moved.w, 2, 'rotation swaps width'); near(moved.d, 8, 'scaled width becomes depth');
    assert.ok(!fixture.authoredPads.some(pad => Math.abs(pad.x) < 1e-6), 'old footprint removed');
    fixture.editor.remove(); drainEditorFrames();
    assert.equal(fixture.authoredPads.length, 1, 'deleted building stops blocking walking');
    fixture.editor.undo(); drainEditorFrames();
    assert.ok(fixture.authoredPads.some(pad => Math.abs(pad.x - 12) < 1e-6), 'undo restores the moved collider');
    fixture.editor.undo(); drainEditorFrames();
    assert.deepEqual(fixture.authoredPads, original, 'undo restores original geometry placement');
    fixture.editor.select('authored:0'); fixture.editor.change({ x: 9 }); drainEditorFrames();
    fixture.editor.reset(); drainEditorFrames();
    assert.deepEqual(fixture.authoredPads, original, 'reset invalidates transformed collider cache');
  } finally { fixture.dispose(); }
});

test('same-id source replacement rebuilds geometry and cached bounds across import and undo', async () => {
  const fixture = await createEditorBenchmarkFixture({ groups: 0, meshes: 0, dynamic: 1 });
  try {
    const old = fixtureEntry('prop:0', 'fixture:short', { x: 6, z: -4 });
    await fixture.editor.importJSON(documentWith([old])); drainEditorFrames();
    near(fixture.dynamicPads[0].w, 2, 'short model bounds');
    const next = { ...old, source: 'fixture:long' };
    await fixture.editor.importJSON(documentWith([next])); drainEditorFrames();
    near(fixture.dynamicPads[0].w, 7, 'replaced model bounds');
    const placed = fixture.scene.getObjectByName('Editor streamed objects').children[0];
    near(new T.Box3().setFromObject(placed).getSize(new T.Vector3()).x, 7, 'visible source was replaced too');
    fixture.editor.undo(); drainEditorFrames(); near(fixture.dynamicPads[0].w, 2, 'undo source replacement');
    fixture.editor.redo(); drainEditorFrames(); near(fixture.dynamicPads[0].w, 7, 'redo source replacement');
    fixture.editor.select('prop:0'); fixture.editor.change({ y: 5 }); drainEditorFrames();
    assert.deepEqual(fixture.dynamicPads, [], 'raised geometry no longer blocks ground movement');
    fixture.editor.undo(); drainEditorFrames(); near(fixture.dynamicPads[0].w, 7, 'undo raised geometry');
    fixture.editor.select('prop:0'); fixture.editor.remove(); drainEditorFrames();
    assert.deepEqual(fixture.dynamicPads, [], 'removing last dynamic prop publishes empty colliders');
    fixture.editor.undo(); drainEditorFrames(); near(fixture.dynamicPads[0].w, 7, 'undo removed dynamic prop');
  } finally { fixture.dispose(); }
});

test('changing fence length rebuilds its model and segmented walking colliders with undo parity', async () => {
  const fixture = await createEditorBenchmarkFixture({ groups: 0, meshes: 0, dynamic: 0, includePropAssets: true });
  try {
    await fixture.editor.importJSON(documentWith([fixtureEntry('prop:fence', 'modular-fence', { length: 3 })]));
    drainEditorFrames(); fixture.editor.select('prop:fence');
    const oldBounds = bounds(fixture.dynamicPads);
    const oldCount = fixture.dynamicPads.length;
    const oldModel = fixture.scene.getObjectByName('Editor streamed objects').children[0];
    const oldWidth = new T.Box3().setFromObject(oldModel).getSize(new T.Vector3()).x;
    fixture.editor.setLength(9); drainEditorFrames();
    const grownBounds = bounds(fixture.dynamicPads);
    const grownModel = fixture.scene.getObjectByName('Editor streamed objects').children[0];
    assert.notEqual(grownModel, oldModel, 'length edits rebuild the source geometry');
    near(grownBounds.maxX - grownBounds.minX, oldBounds.maxX - oldBounds.minX + 6, 'collider length grows by six metres');
    near(new T.Box3().setFromObject(grownModel).getSize(new T.Vector3()).x, oldWidth + 6, 'rendered length grows by six metres');
    assert.ok(fixture.dynamicPads.length > oldCount, 'wall remains segmented rather than one broad obstacle');
    fixture.editor.undo(); drainEditorFrames(); assert.deepEqual(bounds(fixture.dynamicPads), oldBounds);
    fixture.editor.redo(); drainEditorFrames(); assert.deepEqual(bounds(fixture.dynamicPads), grownBounds);
  } finally { fixture.dispose(); }
});
