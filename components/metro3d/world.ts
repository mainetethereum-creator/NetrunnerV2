export type Point = { x: number; z: number };
export type Room = { name: string; role: 'entry'|'platform'|'service'|'rest'|'arena'|'exit'; x: number; z: number; w: number; d: number };
export const CELL = 1.4;
export const GRID = 48;
export const LEVELS = [
  { name:'OLD STATION', subtitle:'Abandoned transit level', accent:'#d7a36a', wall:'#677d77', seed:149 },
  { name:'TECH TUNNELS', subtitle:'Maintenance network', accent:'#7cd8c0', wall:'#4e706a', seed:271 },
  { name:'POWER COMPLEX', subtitle:'Reactor feed sector', accent:'#e6bd58', wall:'#7b7860', seed:419 },
  { name:'RESTRICTED SECTOR', subtitle:'Research wing / core access', accent:'#83bfdb', wall:'#647985', seed:587 },
] as const;
const plans: Room[][] = [
  [
    {name:'Arrival concourse',role:'entry',x:19,z:35,w:10,d:9},
    {name:'Platform 04',role:'platform',x:17,z:19,w:17,d:12},
    {name:'Service workshop',role:'service',x:4,z:23,w:9,d:8},
    {name:'Waiting room',role:'rest',x:36,z:24,w:9,d:8},
    {name:'Departure hall',role:'arena',x:18,z:3,w:15,d:12},
    {name:'Lower-line lift',role:'exit',x:36,z:5,w:8,d:8},
  ],
  [
    {name:'Service lift',role:'entry',x:3,z:34,w:9,d:9},
    {name:'Ventilation gallery',role:'platform',x:17,z:31,w:15,d:10},
    {name:'Pipe junction',role:'service',x:18,z:16,w:11,d:10},
    {name:'Maintenance shelter',role:'rest',x:3,z:15,w:10,d:9},
    {name:'Repair depot',role:'arena',x:32,z:9,w:13,d:15},
    {name:'Pressure lift',role:'exit',x:19,z:3,w:8,d:8},
  ],
  [
    {name:'Power access',role:'entry',x:34,z:34,w:9,d:9},
    {name:'Distribution hall',role:'platform',x:16,z:31,w:14,d:11},
    {name:'Switchgear room',role:'service',x:3,z:31,w:9,d:10},
    {name:'Control cabin',role:'rest',x:33,z:18,w:10,d:10},
    {name:'Transformer chamber',role:'arena',x:13,z:12,w:15,d:14},
    {name:'Isolation lift',role:'exit',x:16,z:2,w:9,d:7},
  ],
  [
    {name:'Decontamination',role:'entry',x:19,z:35,w:10,d:9},
    {name:'Research gallery',role:'platform',x:17,z:20,w:15,d:11},
    {name:'Sample archive',role:'service',x:3,z:21,w:10,d:10},
    {name:'Observation room',role:'rest',x:36,z:21,w:9,d:10},
    {name:'Core containment hall',role:'arena',x:14,z:3,w:19,d:13},
    {name:'Emergency extraction',role:'exit',x:37,z:5,w:8,d:9},
  ],
];
export function center(r: Room): Point { return {x:(r.x+r.w/2-GRID/2)*CELL,z:(r.z+r.d/2-GRID/2)*CELL}; }
export function cellPoint(x:number,z:number):Point {return {x:(x+.5-GRID/2)*CELL,z:(z+.5-GRID/2)*CELL};}
export function makeWorld(level:number) {
  const rooms=plans[Math.max(0,Math.min(3,level-1))];
  const tiles=new Set<string>();
  const carve=(x:number,z:number,w:number,d:number)=>{for(let zz=z;zz<z+d;zz++)for(let xx=x;xx<x+w;xx++)tiles.add(`${xx},${zz}`);};
  for(const r of rooms) carve(r.x,r.z,r.w,r.d);
  for(const [a,b] of [[0,1],[1,2],[1,3],[1,4],[4,5]]) {
    const from=rooms[a],to=rooms[b];
    const ax=Math.floor(from.x+from.w/2),az=Math.floor(from.z+from.d/2),bx=Math.floor(to.x+to.w/2),bz=Math.floor(to.z+to.d/2);
    carve(Math.min(ax,bx),az-1,Math.abs(ax-bx)+1,3);
    carve(bx-1,Math.min(az,bz),3,Math.abs(az-bz)+1);
  }
  const blocked=new Set<string>();
  // Props occupy outer room corners, never corridor mouths or room centres.
  for(const r of rooms) for(const [x,z] of [[r.x+1,r.z+1],[r.x+r.w-2,r.z+1]]) blocked.add(`${x},${z}`);
  const cell=(x:number,z:number)=>`${Math.floor(x/CELL+GRID/2)},${Math.floor(z/CELL+GRID/2)}`;
  const canStand=(p:Point,r=.3)=>[[0,0],[-r,-r],[-r,r],[r,-r],[r,r]].every(([dx,dz])=>{const k=cell(p.x+dx,p.z+dz);return tiles.has(k)&&!blocked.has(k);});
  const spawn=center(rooms[0]),exit=center(rooms[5]);
  return {tiles,blocked,rooms,spawn,exit,canStand,roomAt:(p:Point)=>rooms.find(r=>p.x>=(r.x-GRID/2)*CELL&&p.x<(r.x+r.w-GRID/2)*CELL&&p.z>=(r.z-GRID/2)*CELL&&p.z<(r.z+r.d-GRID/2)*CELL)};
}
export type World=ReturnType<typeof makeWorld>;
export function findRoute(world:World,start:Point,end:Point):Point[] {
  if(!world.canStand(end))return [];
  const coords=(p:Point)=>[Math.floor(p.x/CELL+GRID/2),Math.floor(p.z/CELL+GRID/2)];
  const [sx,sz]=coords(start),[ex,ez]=coords(end),root=`${sx},${sz}`,goal=`${ex},${ez}`;
  const queue=[root],parents=new Map<string,string>();parents.set(root,'');
  for(let n=0;n<queue.length;n++) {
    const k=queue[n];
    if(k===goal){const route:Point[]=[end];let c=k;while(c!==root){const [x,z]=c.split(',').map(Number);route.unshift(cellPoint(x,z));c=parents.get(c)!;}return route;}
    const [x,z]=k.split(',').map(Number);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {const next=`${x+dx},${z+dz}`;if(parents.has(next)||!world.tiles.has(next)||world.blocked.has(next))continue; parents.set(next,k);queue.push(next);}
  }
  return [];
}
export function move(world:World,p:Point,dx:number,dz:number):Point {
  const result={...p},steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));
  for(let i=0;i<steps;i++){const x=result.x+dx/steps,z=result.z+dz/steps;if(world.canStand({x,z:result.z}))result.x=x;if(world.canStand({x:result.x,z}))result.z=z;}
  return result;
}
