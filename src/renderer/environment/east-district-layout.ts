/** The east garden ends at a ground-level service fence. Scenery beyond it is
 * deliberately outside navigation, including the expedition interaction gap. */
export const EAST_DISTRICT = { west: 30.8, east: 46.5, north: -10, south: 34, breachZ: 25 } as const;
export const EAST_EXIT = { x: 44.8, z: EAST_DISTRICT.breachZ } as const;
export const EAST_BUILDINGS = [
  { name: 'Workshop', x: 40.5, z: 1.5, w: 8, d: 6 },
  { name: 'ServiceAnnex', x: 43.3, z: 8.4, w: 4.8, d: 5.2 },
] as const;
export const EAST_BEDS = [
  { x: 35.8, z: 17, w: 4.6, d: 5 },
  { x: 42.5, z: 17.3, w: 4.2, d: 5.6 },
  { x: 37.3, z: 29.4, w: 5.4, d: 4.5 },
] as const;
export const EAST_TREES = [[35.5,17.2,.79],[42.5,17.4,.72],[37.3,29.3,.8]] as const;
export const EAST_LANTERNS = [[34,12.5],[40,22],[43,29.5]] as const;
export const EAST_BENCHES = [[34,24,-Math.PI/2],[41,30,Math.PI/2]] as const;
export const EAST_OBSTACLES = [...EAST_BUILDINGS,...EAST_BEDS,
  ...EAST_LANTERNS.map(([x,z])=>({x,z,w:.55,d:.55})),
  ...EAST_BENCHES.map(([x,z])=>({x,z,w:.9,d:2.4})),
];
export function eastGroundHeight(x:number,z:number) {
  return -.14 - Math.max(0,x-64)*.04 + Math.sin(x*.57)*Math.cos(z*.39)*.08;
}
