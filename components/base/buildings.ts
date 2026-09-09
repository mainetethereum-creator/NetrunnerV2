import * as T from "three";

type Palette = Record<"dark" | "wall" | "concrete" | "edge" | "brass" | "rust" | "black" | "green" | "leaf" | "teal" | "amber" | "red", T.Material>;
export type ArchitectureTools = {
  box(x: number, y: number, z: number, w: number, h: number, d: number, mat: T.Material, ry?: number): void;
  cylinder(x: number, y: number, z: number, r: number, h: number, mat: T.Material, rotation?: T.Euler): T.Mesh;
  pipe(points: number[][], radius: number, mat?: T.Material): T.Mesh;
  sign(text: string, sub: string, x: number, y: number, z: number, width: number, color?: string, rotation?: number): void;
  light(x: number, y: number, z: number, color: number, power: number, distance: number): void;
  m: Palette;
  surface(mat: T.MeshStandardMaterial, kind: "concrete" | "metal", scale?: number): T.MeshStandardMaterial;
};

// Architectural hero buildings are authored in Blender and loaded by scene.ts.
export function buildCityArchitecture({ box, cylinder, pipe, sign, light, m, surface }: ArchitectureTools) {
  const workshop = surface(new T.MeshStandardMaterial({ color: '#5b6570', roughness: .7, metalness: .2 }), 'concrete', .5);
  const metroRed = new T.MeshStandardMaterial({ color: '#e99a96', emissive: '#b6504b', emissiveIntensity: 1.1 });
  const blue = new T.MeshStandardMaterial({ color: '#9eb9e0', emissive: '#527ea9', emissiveIntensity: .7 });
  // MetroEntrance: a real stepped entrance volume and edge rails, with the
  // paired sign supports and two-lit tower from our sprite. Sealed in this stage.
  {
    const x = 8.4;
    box(x, 0.13, -8.6, 7.2, 0.24, 4.4, m.black);
    // Raised rear landing; steps descend toward the courtyard.
    box(x - 0.7, 0.92, -10.25, 4.9, 1.75, 0.8, workshop);
    for (let i = 0; i < 7; i++) {
      const y = 1.55 - i * 0.21, z = -9.7 + i * 0.37;
      box(x - 0.7, y / 2 + 0.15, z, 4.9, y, 0.37, m.wall);
      box(x - 0.7, y + 0.15, z + 0.15, 4.8, 0.035, 0.045, m.brass);
    }
    for (const xx of [x - 3.4, x + 2]) {
      box(xx, 0.92, -8.65, 0.36, 1.6, 4.1, workshop);
      pipe([[xx, 2.5, -10.25], [xx, 2.0, -9.1], [xx, 1.0, -6.75]], 0.045, m.brass);
      for (let i = 0; i < 5; i++) box(xx, 0.8 + (4 - i) * 0.23, -10.2 + i * 0.82, 0.07, 1.2, 0.075, m.edge);
    }
    // Gate at the foot keeps the decorative steps outside the playable collider.
    for (let xx = x - 2.6; xx < x + 1.4; xx += 0.29) box(xx, 0.88, -6.5, 0.045, 1.55, 0.075, m.brass);
    box(x - 0.6, 1.48, -6.5, 4.65, 0.055, 0.08, metroRed);
    for (const xx of [x - 3.15, x + 1.7]) {
      box(xx, 1.98, -7.1, 0.38, 3.7, 0.5, workshop);
      box(xx, 3.88, -7.1, 0.58, 0.18, 0.7, m.brass);
      box(xx, 2.67, -6.79, 0.13, 0.8, 0.055, metroRed);
    }
    box(x - 0.7, 3.35, -7.1, 5.25, 0.83, 0.52, m.edge);
    sign("METRO", "LOWER LINES / ACCESS SEALED", x - 0.7, 3.36, -6.81, 4.7, "#e7a5a0");
    // Chunky service tower with perpendicular facade details.
    box(x + 2.85, 2.03, -8.2, 1.35, 4.05, 2.65, workshop);
    for (const y of [0.35, 1.75, 3.15, 4.12]) box(x + 2.85, y, -8.2, 1.53, 0.14, 2.8, m.edge);
    for (const dx of [2.53, 3.16]) box(x + dx, 1.0, -6.82, 0.12, 1.08, 0.07, dx < 3 ? m.teal : metroRed);
    for (let y = 2; y < 2.9; y += 0.15) box(x + 2.85, y, -6.79, 0.86, 0.06, 0.1, m.brass);
    cylinder(x + 2.85, 4.68, -8.1, 0.045, 1.0, m.brass);
    cylinder(x + 2.85, 5.23, -8.1, 0.095, 0.15, m.teal);
    // Ticket kiosks from the sprite are now freestanding objects.
    for (const xx of [x - 3.1, x + 1.75]) {
      box(xx, 0.8, -6.23, 0.46, 1.45, 0.47, workshop);
      box(xx, 1.16, -5.97, 0.3, 0.27, 0.035, blue);
      box(xx, 0.65, -5.97, 0.2, 0.04, 0.035, metroRed);
    }
    light(x - 0.6, 2.5, -5.8, 0xffa183, 22, 7);
  }
}
