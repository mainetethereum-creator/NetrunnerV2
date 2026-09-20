/** The east garden ends at a ground-level service fence. Scenery beyond it is
 * deliberately outside navigation, including the expedition interaction gap. */
export const EAST_DISTRICT = { west: 30.8, east: 46.5, north: -10, south: 34, breachZ: 25 } as const;
export const EAST_EXIT = { x: 44.8, z: EAST_DISTRICT.breachZ } as const;
/** The visible precast wall stops at the old eight-metre damaged opening. The
 * navigation boundary remains continuous and is owned by the Base world. */
export const EAST_BOUNDARY_RUNS = [[EAST_DISTRICT.north,21],[29,EAST_DISTRICT.south]] as const;
/** A narrow service trail continues into the grounded railway shoulder. It is
 * scenery beyond the expedition interaction, rather than a playable route. */
export const EAST_TRAIL_POINTS = [
  [46.55,25],[49,25.25],[52,26.45],[55.5,27.75],[59.25,27.15],[63.5,25.6],
] as const;
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
type TrailDecoration = {x:number;z:number;yaw:number;scale:number;variant:number};
function trailCenter(t:number) {
  const x=EAST_TRAIL_POINTS[0][0]+(EAST_TRAIL_POINTS.at(-1)![0]-EAST_TRAIL_POINTS[0][0])*t;
  let segment=1;
  while(segment<EAST_TRAIL_POINTS.length-1&&x>EAST_TRAIL_POINTS[segment][0])segment++;
  const a=EAST_TRAIL_POINTS[segment-1],b=EAST_TRAIL_POINTS[segment],u=(x-a[0])/(b[0]-a[0]);
  return {x,z:a[1]+(b[1]-a[1])*u};
}
function random01(index:number,salt:number) {
  const value=Math.sin(index*91.731+salt*37.119)*43758.5453;
  return value-Math.floor(value);
}
/** Deterministic, renderer-independent scatter: stones edge the path and three
 * plant families build up toward the railway without covering its centre. */
export const EAST_TRAIL_ROCKS:TrailDecoration[]=Array.from({length:34},(_,i)=>{
  const t=(i+.35)/34,center=trailCenter(t),side=i%2?1:-1;
  return {x:Math.max(EAST_DISTRICT.east+.18,center.x+(random01(i,1)-.5)*.65),z:center.z+side*(1.28+random01(i,2)*.78),yaw:random01(i,3)*Math.PI*2,scale:.32+random01(i,4)*.46,variant:i%3};
});
export const EAST_TRAIL_PLANTS:TrailDecoration[]=Array.from({length:78},(_,i)=>{
  const t=(i+.2)/78,center=trailCenter(t),side=i%2?1:-1;
  return {x:Math.max(EAST_DISTRICT.east+.35,center.x+(random01(i,5)-.5)*1.1),z:center.z+side*(2.15+random01(i,6)*4.5),yaw:random01(i,7)*Math.PI*2,scale:.62+random01(i,8)*.72,variant:i%3};
});
export function eastGroundHeight(x:number,z:number) {
  return -.14 - Math.max(0,x-64)*.04 + Math.sin(x*.57)*Math.cos(z*.39)*.08;
}
