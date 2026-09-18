import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { bindBaseColliderEdit, BASE_COLLIDER_OWNERS } from '../components/base/editor-colliders.ts';
import { canStand, COLLIDERS, clearBaseEditor } from '../components/base/world.ts';

test('every authored Base collider has exactly one editable owner', () => {
  const owned = Object.values(BASE_COLLIDER_OWNERS).flat().sort((a,b) => a-b);
  assert.deepEqual(owned, COLLIDERS.map((_,i) => i));
});

test('deleting/moving a planter removes its original collision and reset restores it', () => {
  const original = structuredClone(COLLIDERS);
  const root = new T.Group(); root.position.set(-5.4, .08, .2);
  const change = bindBaseColliderEdit('base:planter-west', root);
  try {
    assert.equal(canStand({x:-5.4,z:.2}), false);
    change({deleted:true}); assert.equal(canStand({x:-5.4,z:.2}), true);
    change({}); assert.equal(canStand({x:-5.4,z:.2}), false);
    root.position.set(-5.4,.08,4); change({});
    assert.equal(canStand({x:-5.4,z:.2}), true);
    assert.equal(canStand({x:-5.4,z:4}), false);
    root.position.y=5; change({}); assert.equal(canStand({x:-5.4,z:4}), true);
    root.position.set(-5.4,.08,.2); change({});
    assert.equal(canStand({x:-5.4,z:.2}), false);
    assert.deepEqual(COLLIDERS,original);
  } finally { clearBaseEditor(); }
});
