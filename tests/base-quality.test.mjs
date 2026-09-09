import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adaptQuality, initialQuality, renderRatio } from '../components/base/quality.ts';

test('mobile defaults to Lite, explicit High remains available', () => {
  assert.equal(initialQuality(true).high, false);
  assert.equal(initialQuality(true, 'high').high, true);
});
test('only sustained low performance lowers Auto; healthy windows reset the count', () => {
  let q = initialQuality(false);
  q = adaptQuality(q, 30); q = adaptQuality(q, 35);
  assert.equal(q.high, true);
  assert.equal(adaptQuality(q, 60).slowWindows, 0);
  q = adaptQuality(q, 31); assert.equal(q.high, false);
  for (let i = 0; i < 60; i++) q = adaptQuality(q, 30);
  assert.equal(q.scale, 0.7);
  assert.equal(adaptQuality(q, 90).high, false);
});
test('explicit modes are stable and invalid frame samples are ignored', () => {
  for (const mode of ['high', 'lite']) {
    const q = initialQuality(false, mode); assert.deepEqual(adaptQuality(q, 10), q);
  }
  const q = initialQuality(false); assert.deepEqual(adaptQuality(q, NaN), q);
});
test('dense phone displays stay inside pixel budget at common screen sizes', () => {
  const q = initialQuality(true);
  for (const [w, h] of [[390, 844], [844, 390], [1440, 900]]) {
    const ratio = renderRatio(w, h, 3, q);
    assert.ok(w * h * ratio * ratio <= 700001); assert.ok(ratio <= 1);
  }
});

test('texture filtering keeps oblique PBR surfaces stable when the camera stops', async () => {
  const source = await readFile(new URL('../components/base/materials.ts', import.meta.url), 'utf8');
  assert.match(source, /LinearMipmapLinearFilter/);
  assert.match(source, /Math\.min\(16, maxAnisotropy\)/);
  assert.match(source, /kind === "stone" \? \.58/);
});
