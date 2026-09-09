export type Point = { x: number; z: number };
export type Rect = { x: number; z: number; w: number; d: number };
export type StationId = "smith" | "contracts" | "metro" | "city" | "stash" | "charge" | "oracle" | "market";
export const SPAWN: Point = { x: 0, z: 5 };
export const PLAYER_RADIUS = 0.32;
export const BASE_EXPANSION = Math.sqrt(1.3);
export const LIMIT = { x: 12.5 * BASE_EXPANSION, z: 9.4 * BASE_EXPANSION };
export const COLLIDERS: Rect[] = [
  { x: -8.4, z: -8.6, w: 7.2, d: 4.4 },
  { x: 0, z: -9, w: 6.4, d: 4 },
  { x: 8.5, z: -8.2, w: 7.2, d: 5.6 },
  { x: -14.8, z: 0, w: 1, d: 5.5 },
  { x: -10.5, z: 4.1, w: 2.2, d: 2.5 },
  { x: -5.4, z: 0.2, w: 2.8, d: 1.25 },
  { x: 5.1, z: 0.2, w: 2.8, d: 1.25 },
  { x: -7.4, z: -5.6, w: 1.35, d: 0.75 },
  { x: 0, z: -3.7, w: 2.25, d: .85 },
  { x: 19, z: 4.8, w: 8, d: 0.12 },
  { x: 19, z: 10.2, w: 8, d: 0.12 },
  { x: 26, z: 4, w: 6, d: 0.25 },
  { x: 29, z: 7.5, w: 0.25, d: 7 },
  { x: 26, z: 11, w: 6, d: 0.25 },
  { x: 23, z: 5, w: 0.25, d: 2 },
  { x: 23, z: 10, w: 0.25, d: 2 },
  { x: 26, z: 5.1, w: 2, d: 1.1 },
];

export const STATIONS: { id: StationId; name: string; role: string; x: number; z: number; color: string }[] = [
  { id: "smith", name: "CYBERSMITH", role: "Power & fabrication", x: -7.3, z: -4.6, color: "#edb568" },
  { id: "contracts", name: "CRYPTOMANCER", role: "Contract handler", x: 0, z: -2.4, color: "#78cbbb" },
  { id: "oracle", name: "ORACLE", role: "Classes & abilities", x: 2.1, z: -5.4, color: "#93bfed" },
  { id: "market", name: "GREEN EXCHANGE", role: "Cannabis marketplace", x: -8, z: 3, color: "#a5c791" },
  { id: "metro", name: "THE KEEPER", role: "Lower-line access", x: 8, z: -4.7, color: "#dba577" },
  { id: "city", name: "CITY AIRLOCK", role: "Neon Sprawl", x: -13, z: 0, color: "#78cbbb" },
  { id: "stash", name: "PERSONAL LOCKER", role: "A place to return to", x: -9, z: 4.2, color: "#b5c2c6" },
  { id: "charge", name: "QUANTUM CHARGE", role: "Daily charging station", x: 26, z: 6.3, color: "#78dfe9" },
];

export function canStand(p: Point, radius = PLAYER_RADIUS): boolean {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) return false;
  const inBase = Math.abs(p.x) <= LIMIT.x - radius && Math.abs(p.z) <= LIMIT.z - radius;
  const inCorridor = p.x >= 13 + radius && p.x <= 24 - radius && p.z >= 4.8 + radius && p.z <= 10.2 - radius;
  const inRoom = p.x >= 23 + radius && p.x <= 29 - radius && p.z >= 4 + radius && p.z <= 11 - radius;
  if (!inBase && !inCorridor && !inRoom) return false;
  return !COLLIDERS.some((r) => {
    const nx = Math.max(r.x - r.w / 2, Math.min(p.x, r.x + r.w / 2));
    const nz = Math.max(r.z - r.d / 2, Math.min(p.z, r.z + r.d / 2));
    return (p.x - nx) ** 2 + (p.z - nz) ** 2 < radius ** 2;
  });
}

export function moveWithCollision(p: Point, dx: number, dz: number): Point {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.12));
  const out = { ...p };
  for (let i = 0; i < steps; i++) {
    if (canStand({ x: out.x + dx / steps, z: out.z })) out.x += dx / steps;
    if (canStand({ x: out.x, z: out.z + dz / steps })) out.z += dz / steps;
  }
  return out;
}

// A small deterministic navigation grid: clicks route around planters and machinery.
export function findPath(start: Point, end: Point): Point[] {
  const step = 0.5;
  const key = (p: Point) => `${Math.round(p.x / step)},${Math.round(p.z / step)}`;
  const snap = (p: Point) => ({ x: Math.round(p.x / step) * step, z: Math.round(p.z / step) * step });
  if (!canStand(end)) return [];
  const a = snap(start), b = snap(end);
  if (!canStand(a) || !canStand(b)) return [];
  const queue = [a], seen = new Set([key(a)]), parent = new Map<string, Point>();
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (let n = 0; n < queue.length; n++) {
    const p = queue[n];
    if (key(p) === key(b)) {
      const path = [end];
      let curr = p;
      while (key(curr) !== key(a)) { path.unshift(curr); curr = parent.get(key(curr))!; }
      path.unshift(a);
      return path;
    }
    for (const [dx, dz] of directions) {
      const next = { x: p.x + dx * step, z: p.z + dz * step };
      if (seen.has(key(next)) || !canStand(next)) continue;
      // Never cut a solid corner on a diagonal.
      if (!canStand({ x: next.x, z: p.z }) || !canStand({ x: p.x, z: next.z })) continue;
      seen.add(key(next)); parent.set(key(next), p); queue.push(next);
    }
  }
  return [];
}

export function nearestStation(p: Point) {
  let best: (typeof STATIONS)[number] | null = null;
  let distance = 2.05;
  for (const station of STATIONS) {
    const d = Math.hypot(p.x - station.x, p.z - station.z);
    if (d < distance) { best = station; distance = d; }
  }
  return best;
}
