/** Metres in the same world coordinates as the published city. No renderer state. */
export const SAKURA_PARK = { west: -32, east: 32, north: 11, south: 34, fountainX: 3.2, fountainZ: 20.8, fountainScale: 2.2 } as const;
export const SAKURA_TREES = [
  [-29,15,1.2],[-21,15.1,1.05],[-9.5,15.6,.92],[10,14,1.15],[19,15,1.15],[29,17,1.1],
  [-28,28,1.1],[-17,30,1.05],[22,30.5,1.05],[30,29,1.2],
] as const;
export const PARK_BEDS = [...SAKURA_TREES,[-7.5,31,1],[7,31.5,1],[-10,20,1],[15,25,1]] as const;
export const PARK_STALLS = [[-16.3,22.5,.28,1.4],[22,15.6,.28,1.4]] as const;
export const PARK_LANTERNS = [[-26,19],[-21,25],[-11,18],[-7,26],[11.5,19],[8,28],[22,23],[28,25]] as const;
export const PARK_STONE_LANTERNS = [[-27,23],[-19,28],[-10,16],[5,29.2],[13,16],[27,29]] as const;
export const PARK_BENCHES = [[-23,19,0],[-9,19,0],[12.5,17.5,0],[24,20,-.3],[-11,28,Math.PI],[15,28,Math.PI]] as const;
export const DELIVERY_PERIOD = 190;
/** Three deliveries follow one continuous clear loop; direction is its tangent. */
export function deliveryPose(seconds: number, index: number) {
  const phase = ((seconds / DELIVERY_PERIOD + index / 3) % 1 + 1) % 1;
  const angle = phase * Math.PI * 2;
  const x = SAKURA_PARK.fountainX + Math.cos(angle) * 6.8, z = SAKURA_PARK.fountainZ + Math.sin(angle) * 5.8;
  return { x, z, yaw: Math.atan2(-6.8*Math.sin(angle), 5.8*Math.cos(angle)) };
}
type GardenPoint = {x:number;z:number};
const WALK_CURVES = [
  [[-32,19],[-25,15],[-18,27],[-6,24]],
  [[-32,13],[-18,14],[-6,17],[3.2,14.8]],
  [[3.2,14.8],[14,12.5],[18,17],[32,19]],
  [[9,25],[17,26],[22,17],[32,25]],
  [[3.2,28.6],[12,34],[24,26],[32,31]],
  [[-32,29],[-20,32],[-12,24],[-3,27]],
] as const;
export const PARK_WALKS: GardenPoint[][] = WALK_CURVES.map(curve=>Array.from({length:33},(_,i)=>{
  const t=i/32,u=1-t,[a,b,c,d]=curve;
  return {x:u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],z:u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]};
}));
/** Shared path mask for paving, reflection and vegetation placement. */
export function parkWalkwayContains(p:GardenPoint,margin=0) {
  if(p.z<13+margin)return true;
  const radius=Math.hypot(p.x-SAKURA_PARK.fountainX,p.z-SAKURA_PARK.fountainZ);
  if(radius>=5.0-margin && radius<=7.8+margin)return true;
  for(const path of PARK_WALKS)for(let i=1;i<path.length;i++) {
    const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z;
    const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));
    if(Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t)<1.4+margin)return true;
  }
  return PARK_STALLS.some(([x,z])=>Math.abs(p.x-x)<3+margin&&Math.abs(p.z-z)<3+margin);
}
/** Shared scenery footprints keep visible rocks solid without narrowing the paths. */
export const PARK_ROCKS=PARK_BEDS.flatMap(([x,z,s],i)=>Array.from({length:3},(_,j)=>{
  const yaw=i*2.4+j*2.1;
  return {x:x+Math.cos(yaw)*3.3*s,z:z+Math.sin(yaw)*1.65*s,yaw,j,w:.45+j*.17,h:.38+j*.1,d:.5+j*.18};
})).filter(p=>!parkWalkwayContains(p,.7));
export function parkObstacles() {
  return [
    { x: SAKURA_PARK.fountainX, z: SAKURA_PARK.fountainZ, w: 4.65*SAKURA_PARK.fountainScale, d: 4.65*SAKURA_PARK.fountainScale },
    ...PARK_STALLS.map(([x,z,,s]) => ({ x, z: z + .2, w: 4.2*s, d: 3.9*s })),
    ...SAKURA_TREES.map(([x,z]) => ({ x, z, w: .8, d: .8 })),
    ...PARK_BENCHES.map(([x,z]) => ({ x, z, w: 1.9, d: .7 })),
    ...PARK_LANTERNS.map(([x,z]) => ({ x, z, w: .55, d: .55 })),
    ...PARK_STONE_LANTERNS.map(([x,z]) => ({ x, z, w: .88, d: .88 })),
    ...PARK_ROCKS.map(({x,z,w,d})=>({x,z,w:2*Math.max(w,d),d:2*Math.max(w,d)})),
  ];
}
