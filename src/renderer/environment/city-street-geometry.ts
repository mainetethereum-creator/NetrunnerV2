import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Temporary pieces are merged once; the caller owns only the returned buffers. */
export class StreetGeometry {
  private buckets = new Map<string, T.BufferGeometry[]>();

  add(finish: string, geometry: T.BufferGeometry) {
    if (geometry.index) {
      const expanded = geometry.toNonIndexed();
      geometry.dispose();
      geometry = expanded;
    }
    // Every primitive uses the same attribute set, including custom profiles.
    geometry.deleteAttribute('uv');
    const bucket = this.buckets.get(finish) ?? [];
    bucket.push(geometry);
    this.buckets.set(finish, bucket);
  }

  box(finish: string, x: number, y: number, z: number, w: number, h: number, d: number) {
    this.add(finish, new T.BoxGeometry(w, h, d).translate(x, y, z));
  }

  cylinder(finish: string, x: number, y: number, z: number, radius: number, height: number, axle = false) {
    const geometry = new T.CylinderGeometry(radius, radius, height, 12);
    if (axle) geometry.rotateX(Math.PI / 2);
    this.add(finish, geometry.translate(x, y, z));
  }

  /** Closed profile extruded across Z. Contour is CCW in the X/Y plane. */
  profile(finish: string, outline: [number, number][], halfWidth: number) {
    const shape = new T.Shape(outline.map(([x, y]) => new T.Vector2(x, y)));
    const geometry = new T.ExtrudeGeometry(shape, { depth: halfWidth * 2, bevelEnabled: false, steps: 1, curveSegments: 1 });
    this.add(finish, geometry.translate(0, 0, -halfWidth));
  }

  quad(finish: string, points: [number, number, number][]) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute([0, 1, 2, 0, 2, 3].flatMap(index => points[index]), 3));
    geometry.computeVertexNormals();
    this.add(finish, geometry);
  }

  finish(): Map<string, T.BufferGeometry> {
    const result = new Map<string, T.BufferGeometry>();
    for (const [finish, pieces] of this.buckets) {
      const geometry = mergeGeometries(pieces)!;
      pieces.forEach(piece => piece.dispose());
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      result.set(finish, geometry);
    }
    this.buckets.clear();
    return result;
  }
}

/** Locally generated grain. No canvas, network request or external asset lifetime. */
export function streetGrain() {
  const size = 128, data = new Uint8Array(size * size * 4);
  let seed = 71923;
  for (let index = 0; index < size * size; index++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = 150 + (seed % 90);
    data.set([value, value, value, 255], index * 4);
  }
  const texture = new T.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(85, 5);
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function roadGlowTexture() {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const distance = Math.hypot((x + .5 - size / 2) / (size / 2), (y + .5 - size / 2) / (size / 2));
    const alpha = Math.pow(Math.max(0, 1 - distance), 2);
    data.set([255, 255, 255, Math.round(alpha * 255)], (y * size + x) * 4);
  }
  const texture = new T.DataTexture(data, size, size);
  texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
