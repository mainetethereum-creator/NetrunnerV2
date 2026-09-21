import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('canal normal pilot is a mipmapped 1024px KTX2 with runtime fallback', () => {
  const texture = readFileSync('public/game/canal/v1/water-normal.ktx2');
  assert.deepEqual([...texture.subarray(0, 12)], [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(texture.readUInt32LE(20), 1024);
  assert.equal(texture.readUInt32LE(24), 1024);
  assert.equal(texture.readUInt32LE(40), 11);
  assert.ok(texture.length < readFileSync('public/game/canal/v1/water-normal.webp').length);

  const scene = readFileSync('components/base/scene.ts', 'utf8');
  assert.match(scene, /ktx2\.loadAsync\(ASSET_URLS\.canalNormalKtx2\)/);
  assert.match(scene, /TextureLoader\(loader\.manager\)\.loadAsync\(ASSET_URLS\.canalNormal\)/);
});
