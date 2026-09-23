import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ASSET_URLS } from '../../src/assets/registry.ts';
import { createCityBackdrop } from '../../src/renderer/environment/city-backdrop.ts';
import { groundMaterial } from './landscape';
import type { Point } from './config';

/** Non-playable terrain continuation around the 200 x 128 authored landscape. */
export function createExpeditionHorizon(scene: T.Scene, height: (p: Point) => number, onError: (message: string) => void) {
  const backdrop = createCityBackdrop(scene, onError, {
    url: ASSET_URLS.outlandsBackdrop, center: [72, 0, 36], haze: '#192738', brightness: .55, mirrored: true,
  });
  const parts: T.BufferGeometry[] = [];
  // Aprons begin at the existing outer edge. No overlap with navigable ground.
  for (const [x, z, w, d] of [[72, -108, 520, 160], [72, 180, 520, 160], [-108, 36, 160, 128], [252, 36, 160, 128]]) {
    const geometry = new T.PlaneGeometry(w, d, Math.ceil(w / 4), Math.ceil(d / 4));
    geometry.rotateX(-Math.PI / 2); geometry.translate(x, 0, z);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const px = positions.getX(i), pz = positions.getZ(i);
      positions.setY(i, height({ x: px, z: pz }) - .03);
    }
    geometry.computeVertexNormals(); parts.push(geometry);
  }
  const geometry = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  const material = groundMaterial(false);
  const ground = new T.Mesh(geometry, material);
  ground.name = 'Outlands distant ground'; ground.receiveShadow = true;
  scene.add(ground);
  return { ready: backdrop.ready, dispose() {
    backdrop.dispose(); ground.removeFromParent(); geometry.dispose(); material.dispose();
  } };
}
