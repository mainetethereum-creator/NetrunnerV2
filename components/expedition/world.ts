import { POIS, SPAWN, EXTRACTIONS, type Point, type Rect } from './config.ts';
import {DRESSING_COLLIDERS} from './dressing-layout.ts';
import {insideLandscape,terrainHeight,HANGARS} from './terrain.ts';
import {makeTrees,FOUNTAIN,RUIN_WALLS} from './nature-layout.ts';
import {makeVegetationTrees} from '../vegetation/layout.ts';
export type {Point} from './config.ts';
export type Solid=Rect & {h:number;kind:'building'|'barrier'|'container'};
export const SOLIDS:Solid[]=[];
// Authored roadside clusters leave the highway and two flanking routes open.
for(let x=12;x<140;x+=16)for(const z of [5,66])SOLIDS.push({x,z,w:10,d:8,h:4+(x%3)*2,kind:'building'});
for(const p of POIS) {
  if(p.id==='catwalk'||p.id==='fountain')continue;
  SOLIDS.push({x:p.x,z:p.z-5,w:p.kind==='warehouse'?12:7,d:5,h:p.kind==='power'?10:4.5,kind:'building'});
  if(p.kind==='warehouse')SOLIDS.push({x:p.x+10,z:p.z,w:3,d:7,h:2.6,kind:'container'});
}
SOLIDS.push({x:58,z:36,w:3,d:11,h:1.5,kind:'barrier'},{x:111,z:36,w:3,d:10,h:1.6,kind:'barrier'});
const PROP_COLLIDERS:Rect[]=[...POIS.map(p=>({x:p.x+1.4,z:p.z,w:1.3,d:.9})),{x:2,z:24,w:1,d:14},{x:2,z:48,w:1,d:14},{x:22,z:20,w:1,d:.8},{x:28,z:20,w:1,d:.8}];
const STATIC_COLLIDERS=[...SOLIDS,...PROP_COLLIDERS,...DRESSING_COLLIDERS,...HANGARS,FOUNTAIN,...RUIN_WALLS];
const BASE_TREES=makeTrees(STATIC_COLLIDERS);
export const VEGETATION_TREES=makeVegetationTrees([...STATIC_COLLIDERS,...BASE_TREES.map(t=>({x:t.x,z:t.z,w:1.2,d:1.2}))]);
export const TREES=BASE_TREES.filter(t=>!VEGETATION_TREES.some(v=>Math.hypot(t.x-v.x,t.z-v.z)<3.2));
const WORLD_COLLIDERS=[...STATIC_COLLIDERS,...VEGETATION_TREES.map(t=>({x:t.x,z:t.z,w:.72*t.scale,d:.72*t.scale})),...TREES.map(t=>({x:t.x,z:t.z,w:.8*t.scale,d:.8*t.scale}))];
export function makeWorld(){
  const canStand=(p:Point,r=.34)=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&insideLandscape(p,r)&&!WORLD_COLLIDERS.some(s=>{
    const x=Math.max(s.x-s.w/2,Math.min(p.x,s.x+s.w/2)),z=Math.max(s.z-s.d/2,Math.min(p.z,s.z+s.d/2));return (p.x-x)**2+(p.z-z)**2<r*r;
  });
  return {canStand,spawn:SPAWN,exit:EXTRACTIONS[1]};
}
export type World=ReturnType<typeof makeWorld>;
export function elevationAt(p:Point){return terrainHeight(p)+(p.z>=56.5&&p.z<=59.5&&p.x>=96&&p.x<=110?Math.min(1.6,(p.x-96)*.4):0);}
const stepAllowed=(a:Point,b:Point)=>Math.abs(elevationAt(a)-elevationAt(b))<=.55*Math.hypot(a.x-b.x,a.z-b.z)+.001;
export function move(world:World,p:Point,dx:number,dz:number):Point {
  const out={x:p.x,z:p.z},steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));
  for(let i=0;i<steps;i++){const x={x:out.x+dx/steps,z:out.z};if(world.canStand(x)&&stepAllowed(out,x))out.x=x.x;const z={x:out.x,z:out.z+dz/steps};if(world.canStand(z)&&stepAllowed(out,z))out.z=z.z;}return out;
}
export function findRoute(world:World,start:Point,end:Point):Point[]{
  if(!world.canStand(end))return [];
  const snap=(p:Point)=>({x:Math.round(p.x),z:Math.round(p.z)}),key=(p:Point)=>`${p.x},${p.z}`;
  const a=snap(start),b=snap(end);if(!world.canStand(a)||!world.canStand(b))return [];
  const queue=[a],parents=new Map<string,Point|null>([[key(a),null]]);
  for(let i=0;i<queue.length;i++){const p=queue[i];if(key(p)===key(b)){const path=[end];let c:Point|null=p;while(c&&key(c)!==key(a)){path.unshift(c);c=parents.get(key(c))??null;}return path;}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,z:p.z+dz};if(!parents.has(key(n))&&world.canStand(n)&&stepAllowed(p,n)){parents.set(key(n),p);queue.push(n);}}}
  return [];
}
