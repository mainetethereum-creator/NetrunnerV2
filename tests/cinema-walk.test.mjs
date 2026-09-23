import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';

const data = JSON.parse(fs.readFileSync(new URL('../public/game/animations/sentinel-walk-v1.json', import.meta.url)));
const glb = fs.readFileSync(new URL('../public/game/models/mixamo/neon-sentinel-mixamo-test.glb', import.meta.url));
const model = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
const names = new Set(model.nodes.map(node => T.PropertyBinding.sanitizeNodeName(node.name ?? '')));

test('retargeted Mixamo walk binds to the actual hero and loops without a pose jump', () => {
  const clip = T.AnimationClip.parse(data.clip);
  assert.ok(data.stride > 1 && data.stride < 2, 'stride measured in target rig metres');
  assert.ok(clip.duration > 1 && clip.duration < 2);
  assert.ok(clip.tracks.length >= 20);
  for (const track of clip.tracks) {
    assert.ok(names.has(track.name.split('.')[0]), `missing hero bone ${track.name}`);
    assert.ok([...track.values].every(Number.isFinite));
    const width = track.getValueSize();
    if (width === 4) {
      const first = new T.Quaternion().fromArray(track.values);
      const last = new T.Quaternion().fromArray(track.values, track.values.length - 4);
      assert.ok(first.angleTo(last) < .002, `loop discontinuity in ${track.name}`);
    } else {
      for (let i = 0; i < width; i++) assert.ok(Math.abs(track.values[i] - track.values[track.values.length - width + i]) < .002);
    }
  }
});

test('walking hips retain weight transfer with forward root travel removed', () => {
  const track = data.clip.tracks.find(track => track.name === 'mixamorigHips.position');
  // Target armature rotates +90 degrees about X: local -Z is world height.
  const bob = track.values.filter((_, i) => i % 3 === 2);
  const forward = track.values.filter((_, i) => i % 3 === 1);
  assert.ok(Math.max(...bob) - Math.min(...bob) > .02, 'real pelvis weight shift retained');
  assert.ok(Math.max(...forward) - Math.min(...forward) < .15, 'no accumulating forward drift');
});
