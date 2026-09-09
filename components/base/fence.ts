import * as T from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Precast concrete panels, tapered feet and lifting eyes, batched by material. */
export function buildConcretePerimeter(scene: T.Scene, concrete: T.Material, steel: T.Material) {
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  const posts = new Set<string>();
  const transform = new T.Object3D();
  const add = (geometry: T.BufferGeometry, x: number, y: number, z: number, angle: number, mat: T.Material) => {
    if (geometry.index) {
      const expanded = geometry.toNonIndexed(); geometry.dispose(); geometry = expanded;
    }
    transform.position.set(x, y, z); transform.rotation.set(0, angle, 0); transform.scale.set(1, 1, 1); transform.updateMatrix();
    geometry.applyMatrix4(transform.matrix);
    const list = batches.get(mat) ?? []; list.push(geometry); batches.set(mat, list);
  };
  const block = (x: number, y: number, z: number, w: number, h: number, d: number, angle: number, mat = concrete) =>
    add(new RoundedBoxGeometry(w, h, d, 1, Math.min(.035, w / 5, h / 5, d / 5)), x, y, z, angle, mat);
  // The wider base slopes into the vertical post rather than forming a box step.
  const foot = () => {
    const g = new T.BoxGeometry(.67, .55, .98);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setZ(i, p.getZ(i) * .56);
    g.computeVertexNormals(); return g;
  };
  function wall(ax: number, az: number, bx: number, bz: number) {
    const length = Math.hypot(bx - ax, bz - az), count = Math.ceil(length / 3.2), step = length / count;
    const ux = (bx - ax) / length, uz = (bz - az) / length, angle = -Math.atan2(uz, ux);
    for (let i = 0; i <= count; i++) {
      const x = ax + ux * step * i, z = az + uz * step * i;
      const postKey = `${x.toFixed(3)},${z.toFixed(3)}`;
      if (!posts.has(postKey)) {
      posts.add(postKey);
      block(x, 1.45, z, .54, 2.56, .56, angle);
      add(foot(), x, .35, z, angle, concrete);
      // Small dark casting slots in the lower foot, on both faces.
      for (const side of [-1, 1]) block(x - uz * .492 * side, .12, z + ux * .492 * side, .17, .11, .008, angle, steel);
      for (const offset of [-.15, .15]) block(x + ux * offset, 2.84, z + uz * offset, .055, .22, .065, angle, steel);
      block(x, 2.955, z, .35, .055, .065, angle, steel);
      }
      if (i === count) continue;
      const cx = x + ux * step / 2, cz = z + uz * step / 2;
      block(cx, .35, cz, step - .5, .48, .53, angle);
      block(cx, 1.045, cz, step - .48, .87, .25, angle);
      block(cx, 1.94, cz, step - .48, .87, .25, angle);
      // A real recessed joint between panels, plus a narrow bevelled coping.
      block(cx, 2.403, cz, step - .47, .045, .30, angle);
    }
  }
  // Outside the walkable limits. The east side is deliberately torn open into
  // a broad expedition breach instead of ending in a clean manufactured gate.
  wall(-14.8, 11.35, 14.8, 11.35);
  wall(-14.8, -11.6, 14.8, -11.6);
  wall(-14.8, -11.6, -14.8, -2.85);
  wall(-14.8, 2.85, -14.8, 11.35);
  wall(14.8, -11.6, 14.8, 4.65);
  wall(14.8, 10.35, 14.8, 11.35);
  for (const [z, y, sx, sy, sz, twist] of [
    [4.72, .48, .72, .55, .62, .18], [4.88, 1.18, .58, .42, .48, -.28],
    [10.28, .42, .78, .48, .66, -.14], [10.16, 1.08, .52, .38, .46, .34],
  ] as const) {
    const shard = new T.DodecahedronGeometry(.62, 0); shard.scale(sx, sy, sz);
    add(shard, 14.72, y, z, twist, concrete);
  }
  for (const z of [4.86, 5.08, 9.92, 10.14]) {
    block(14.42, 1.46 + (z % .3), z, .82, .055, .055, -.15, steel);
    block(14.5, 2.05 - (z % .25), z, .62, .045, .045, .2, steel);
  }
  for (const [x, z, size] of [[14.2, 5.25, .34], [14.9, 5.5, .24], [14.35, 9.72, .28], [15.15, 9.48, .2]] as const) {
    const rubble = new T.DodecahedronGeometry(size, 0); rubble.scale(1.3, .55, 1);
    add(rubble, x, size * .3, z, x + z, concrete);
  }
  for (const [material, geometries] of batches) {
    const merged = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
    if (!merged) continue;
    const mesh = new T.Mesh(merged, material);
    mesh.name = "Precast perimeter " + material.name;
    mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  }
}
