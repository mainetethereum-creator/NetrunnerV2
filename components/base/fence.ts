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
  // Outside the walkable limits; the east opening meets the charging corridor.
  wall(-14.8, 11.35, 14.8, 11.35);
  wall(-14.8, -11.6, 14.8, -11.6);
  wall(-14.8, -11.6, -14.8, -2.85);
  wall(-14.8, 2.85, -14.8, 11.35);
  wall(14.8, -11.6, 14.8, 6);
  wall(14.8, 9, 14.8, 11.35);
  for (const [material, geometries] of batches) {
    const merged = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
    if (!merged) continue;
    const mesh = new T.Mesh(merged, material);
    mesh.name = "Precast perimeter " + material.name;
    mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  }
}
