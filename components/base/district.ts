import * as T from "three";

/** Background neighbourhood: shared geometry, no shadow maps or extra lights. */
export function addDistrict(scene: T.Scene) {
  const walls = ["#495153", "#605a50", "#454e58", "#665548"].map(color => new T.MeshStandardMaterial({ color, roughness: 0.88 }));
  const trim = new T.MeshStandardMaterial({ color: "#283b3f", roughness: 0.7 });
  const glass = new T.MeshStandardMaterial({ color: "#182c34", metalness: 0.45, roughness: 0.32 });
  const warm = new T.MeshStandardMaterial({ color: "#dbbc83", emissive: "#ffc67a", emissiveIntensity: 0.65 });
  const cool = new T.MeshStandardMaterial({ color: "#74b4be", emissive: "#65c8de", emissiveIntensity: 0.7 });
  const neon = new T.MeshStandardMaterial({ color: "#db8d84", emissive: "#ef6653", emissiveIntensity: 1.6 });
  const batches = new Map<T.Material, T.Matrix4[]>();
  const dummy = new T.Object3D();
  let seed = 789;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  function box(x: number, y: number, z: number, w: number, h: number, d: number, mat: T.Material) {
    dummy.position.set(x, y, z); dummy.scale.set(w, h, d); dummy.updateMatrix();
    if (!batches.has(mat)) batches.set(mat, []);
    batches.get(mat)!.push(dummy.matrix.clone());
  }
  function building(x: number, z: number, w: number, d: number, floors: number, near: boolean) {
    const h = floors * 2.35;
    box(x, h / 2 - 1, z, w, h, d, walls[Math.floor(rand() * walls.length)]);
    box(x, h - 0.85, z, w + 0.3, 0.3, d + 0.3, trim);
    for (let floor = 0; floor < floors; floor++) {
      const y = floor * 2.35 + 0.45;
      for (let dx = -w / 2 + 0.8; dx < w / 2 - 0.4; dx += 1.5) {
        const mat = rand() > 0.55 ? (rand() > 0.3 ? warm : cool) : glass;
        for (const side of [-1, 1]) box(x + dx, y, z + side * (d / 2 + 0.025), 0.72, 1.05, 0.06, mat);
      }
      for (let dz = -d / 2 + 0.8; dz < d / 2 - 0.4; dz += 1.5) {
        const mat = rand() > 0.6 ? warm : glass;
        for (const side of [-1, 1]) box(x + side * (w / 2 + 0.025), y, z + dz, 0.06, 1.05, 0.72, mat);
      }
      if (near || floor % 3 === 0) box(x, y + 0.9, z, w + 0.14, 0.14, d + 0.14, trim);
    }
    box(x + w * 0.18, h - 0.25, z, w * 0.34, 1.2, d * 0.36, trim);
    if (near) {
      // Rooftop tanks, service risers, balconies and shop awnings.
      box(x - w * 0.28, h - 0.1, z - 0.6, 1.1, 1.65, 1.1, walls[1]);
      box(x - w * 0.38, h / 2, z + d / 2 + 0.15, 0.13, h + 1, 0.13, trim);
      box(x, 1.65, z + d / 2 + 0.4, w * 0.65, 0.18, 0.85, walls[3]);
      box(x + w * 0.24, 2.75, z + d / 2 + 0.1, 0.28, 1.4, 0.13, rand() > 0.5 ? cool : neon);
      box(x, 2.5, z + d / 2 + 0.18, w * 0.8, 0.15, 0.5, trim);
      for (let dx = -w * 0.35; dx <= w * 0.35; dx += 0.6) box(x + dx, 2.85, z + d / 2 + 0.4, 0.06, 0.65, 0.06, trim);
    } else if (floors > 7) {
      box(x - w / 2 - 0.03, h * 0.65, z + d / 2, 0.09, h * 0.4, 0.12, cool);
      box(x, h + 0.8, z, 0.12, 3, 0.12, trim);
    }
  }
  box(0, -1.4, 0, 115, 0.5, 115, trim);
  // Continuous perimeter; streets separate successive tiers.
  for (let i = -3; i <= 3; i++) {
    const t = i * 6.8;
    building(t, -16.8, 5.8, 5, 2 + (i % 3 === 0 ? 1 : 0), true);
    building(t, 20, 5.6, 4.8, 2, true);
    if (Math.abs(i) < 3) for (const side of [-1, 1]) building(side * 19.3, i * 6.6, 5, 5.7, 2 + (i % 2 === 0 ? 1 : 0), true);
  }
  for (let i = -4; i <= 4; i++) {
    building(i * 8.1, -29, 6.7, 6.2, 4 + Math.floor(rand() * 3), false);
    for (const side of [-1, 1]) building(side * 31, i * 8, 6, 6.5, 4 + Math.floor(rand() * 3), false);
    building(i * 8, 33, 6.1, 6.2, 4, false);
  }
  for (let i = -4; i <= 4; i++) {
    building(i * 11, -44, 7 + rand() * 2, 7, 8 + Math.floor(rand() * 7), false);
    for (const side of [-1, 1]) building(side * 46, i * 11, 7, 8, 7 + Math.floor(rand() * 5), false);
    building(i * 11, 47, 7, 7, 7 + Math.floor(rand() * 3), false);
  }
  // Elevated conduits and street markings connect the buildings into a district.
  for (const x of [-15, 15]) {
    box(x, 3.9, 0, 0.16, 0.16, 30, trim);
    for (let z = -12; z <= 12; z += 6) {
      box(x, 1.5, z, 0.14, 5, 0.14, trim);
      box(x, 3.7, z, 0.12, 0.18, 0.7, warm);
      box(x, -1.1, z + 1, 0.12, 0.02, 2, warm);
    }
  }
  const geometry = new T.BoxGeometry(1, 1, 1);
  for (const [material, matrices] of batches) {
    const mesh = new T.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.computeBoundingSphere(); mesh.name = "background-district"; scene.add(mesh);
  }
}
