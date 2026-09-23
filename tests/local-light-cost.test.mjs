import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import { createLocalLightOptimizer, guardedLocalLightChunk } from '../src/renderer/three/local-light-cost.ts';

const direct = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';

test('only point and spot direct calls gain visibility guards', () => {
  const original = T.ShaderChunk.lights_fragment_begin;
  const guarded = guardedLocalLightChunk(original);
  assert.ok(guarded);
  assert.equal((guarded.match(/if \( directLight\.visible \) \{ RE_Direct/g)??[]).length, 2);
  const directionalMarker = '#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )';
  assert.equal(guarded.slice(guarded.indexOf(directionalMarker)), original.slice(original.indexOf(directionalMarker)));
  assert.equal((guarded.match(new RegExp(direct.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))??[]).length, 3);
  assert.equal(guardedLocalLightChunk('unrecognized light chunk'), null);
});

test('optimizer composes original material hook and cache key once', () => {
  const material = new T.MeshPhysicalMaterial();
  material.customProgramCacheKey = () => 'original-key';
  material.onBeforeCompile = shader => { shader.fragmentShader = `// existing hook\n${shader.fragmentShader}`; };
  const root = new T.Group();
  root.add(new T.Mesh(new T.BoxGeometry(), material), new T.Mesh(new T.BoxGeometry(), material));
  root.add(new T.LineSegments(new T.BufferGeometry(), new T.LineBasicMaterial()));
  const optimizer = createLocalLightOptimizer();
  assert.equal(optimizer.supported, true);
  assert.equal(optimizer.apply(root), 1);
  assert.equal(optimizer.apply(root), 0);
  assert.equal(material.customProgramCacheKey(), 'original-key|local-light-visible-v1');
  const shader = { fragmentShader: '#include <lights_fragment_begin>', vertexShader: '', uniforms: {} };
  material.onBeforeCompile(shader, {});
  assert.match(shader.fragmentShader, /^\/\/ existing hook/);
  assert.doesNotMatch(shader.fragmentShader, /#include <lights_fragment_begin>/);
  assert.equal((shader.fragmentShader.match(/if \( directLight\.visible \) \{ RE_Direct/g)??[]).length, 2);
  root.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
});
