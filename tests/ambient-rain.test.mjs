import assert from 'node:assert/strict';
import test from 'node:test';
import { createAmbientRain, rainHeight } from '../src/renderer/environment/ambient-rain.ts';

test('rain keeps each streak together through its height wrap', () => {
  assert.equal(rainHeight(2, 1), 1);
  assert.equal(rainHeight(2, 3), 14);
  assert.equal(rainHeight(2, 18), 14);
  for (const distance of [0, 1.9, 2.1, 16, 18, 31.2]) {
    const lower = rainHeight(2, distance);
    const upper = lower + .35;
    assert.ok(upper - lower > .349 && upper - lower < .351);
  }
});

test('ambient rain retains seeded geometry and updates only a shader uniform', () => {
  const values = [.75, .125, .5, .25, .875, .75];
  let index = 0;
  const rain = createAmbientRain(2, () => values[index++]);
  const position = rain.geometry.getAttribute('position');
  const base = rain.geometry.getAttribute('rainBaseY');
  assert.equal(position.count, 4);
  assert.deepEqual(Array.from(position.array).slice(0, 6), [16, 2, 10, 15.9399995803833, 2.3499999046325684, 10]);
  assert.deepEqual(Array.from(base.array), [2, 2, 14, 14]);
  assert.equal(rain.mesh.frustumCulled, false);
  assert.equal(rain.mesh.material.color.getHex(), 0xb9d8d8);
  assert.equal(rain.mesh.material.opacity, .085);

  const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>\nvoid main() {}', fragmentShader: '' };
  rain.mesh.material.onBeforeCompile(shader, {});
  assert.match(shader.vertexShader, /attribute float rainBaseY/);
  assert.match(shader.vertexShader, /transformed\.y = baseY \+ position\.y - rainBaseY/);
  assert.equal(shader.uniforms.rainTravel.value, 0);
  const source = Array.from(position.array);
  rain.update(1);
  assert.equal(shader.uniforms.rainTravel.value, 9);
  rain.update(3);
  assert.equal(shader.uniforms.rainTravel.value, 21);
  assert.deepEqual(Array.from(position.array), source);
  assert.equal(position.needsUpdate, undefined);

  rain.geometry.dispose();
  rain.mesh.material.dispose();
});
