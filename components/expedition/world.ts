import {createLandscapeState} from './landscape-state.ts';
import { POIS, SPAWN, EXTRACTIONS, type Point, type Rect } from './config.ts';
import {MICROBUS} from './microbus-layout.ts';
import {DRESSING_COLLIDERS} from './dressing-layout.ts';
import {insideLandscape,terrainHeight,createTerrainHeight,HANGARS} from './terrain.ts';
import {makeTrees,FOUNTAIN,RUIN_WALLS} from './nature-layout.ts';
import {makeVegetationTrees} from '../vegetation/layout.ts';
import {AUTHORED_COLLIDERS} from './authored-layout.ts';
export type {Point} from './config.ts';
export type Solid=Rect & {h:number;kind:'building'|'barrier'|'container'};
export const SOLIDS:Solid[]=AUTHORED_COLLIDERS.map(s=>({...s}));
const PROP_COLLIDERS:Rect[]=[...POIS.map(p=>({x:p.x+1.4,z:p.z,w:1.3,d:.9})),{x:2,z:24,w:1,d:14},{x:2,z:48,w:1,d:14},{x:22,z:20,w:1,d:.8},{x:28,z:20,w:1,d:.8}];
const STATIC_COLLIDERS=[MICROBUS,...SOLIDS,...PROP_COLLIDERS,...DRESSING_COLLIDERS,...HANGARS,FOUNTAIN,...RUIN_WALLS];
export const VEGETATION_TREES=makeVegetationTrees(STATIC_COLLIDERS);
// Legacy hand-built trees are intentionally disabled. The playable map uses
// only the baked models exported by VegetationGeneratorThreeJS.
export const TREES:ReturnType<typeof makeTrees>=[];
const WORLD_COLLIDERS=[...STATIC_COLLIDERS,...VEGETATION_TREES.map(t=>({x:t.x,z:t.z,w:.72*t.scale,d:.72*t.scale})),...TREES.map(t=>({x:t.x,z:t.z,w:.8*t.scale,d:.8*t.scale}))];
export function makeWorld(){
  const landscape=createLandscapeState(WORLD_COLLIDERS),height=createTerrainHeight(landscape);
  const elevation=(p:Point)=>height(p)+(p.z>=56.5&&p.z<=59.5&&p.x>=96&&p.x<=110?Math.min(1.6,(p.x-96)*.4):0);
  const cells=new Map<string,Rect[]>(),cellSize=8;
  for(const rect of WORLD_COLLIDERS)for(let x=Math.floor((rect.x-rect.w/2)/cellSize);x<=Math.floor((rect.x+rect.w/2)/cellSize);x++)for(let z=Math.floor((rect.z-rect.d/2)/cellSize);z<=Math.floor((rect.z+rect.d/2)/cellSize);z++){const key=x+','+z;const bucket=cells.get(key)??[];bucket.push(rect);cells.set(key,bucket);}
  const nearby=(p:Point,r:number)=>{const found=new Set<Rect>();for(let x=Math.floor((p.x-r)/cellSize);x<=Math.floor((p.x+r)/cellSize);x++)for(let z=Math.floor((p.z-r)/cellSize);z<=Math.floor((p.z+r)/cellSize);z++)for(const rect of cells.get(x+','+z)??[])found.add(rect);return [...found];};
  const canStand=(p:Point,r=.34)=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&insideLandscape(p,r)&&!nearby(p,r).some(s=>{
    const x=Math.max(s.x-s.w/2,Math.min(p.x,s.x+s.w/2)),z=Math.max(s.z-s.d/2,Math.min(p.z,s.z+s.d/2));return (p.x-x)**2+(p.z-z)**2<r*r;
  });
  const navigation=new Map<string,boolean>();let navRevision=-1;
  const routeStand=(p:Point)=>{if(navRevision!==landscape.revision){navigation.clear();navRevision=landscape.revision;}const key=p.x+','+p.z;let allowed=navigation.get(key);if(allowed===undefined){allowed=canStand(p);navigation.set(key,allowed);}return allowed;};
  return {canStand,routeStand,landscape,terrainHeight:height,elevationAt:elevation,spawn:SPAWN,exit:EXTRACTIONS[1]};
}
export type World=ReturnType<typeof makeWorld>;
export function elevationAt(p:Point){return terrainHeight(p)+(p.z>=56.5&&p.z<=59.5&&p.x>=96&&p.x<=110?Math.min(1.6,(p.x-96)*.4):0);}
const stepAllowed=(world:World,a:Point,b:Point)=>Math.abs(world.elevationAt(a)-world.elevationAt(b))<=.55*Math.hypot(a.x-b.x,a.z-b.z)+.001;
export function move(world:World,p:Point,dx:number,dz:number):Point {
  const out={x:p.x,z:p.z},steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));
  for(let i=0;i<steps;i++){const x={x:out.x+dx/steps,z:out.z};if(world.canStand(x)&&stepAllowed(world,out,x))out.x=x.x;const z={x:out.x,z:out.z+dz/steps};if(world.canStand(z)&&stepAllowed(world,out,z))out.z=z.z;}return out;
}
export function findRoute(world:World,start:Point,end:Point):Point[]{
  if(!world.canStand(end))return [];
  const snap=(p:Point)=>({x:Math.round(p.x),z:Math.round(p.z)}),key=(p:Point)=>`${p.x},${p.z}`;
  const a=snap(start),b=snap(end);if(!world.canStand(a)||!world.canStand(b))return [];
  const queue=[a],parents=new Map<string,Point|null>([[key(a),null]]);
  for(let i=0;i<queue.length;i++){const p=queue[i];if(key(p)===key(b)){const path=[end];let c:Point|null=p;while(c&&key(c)!==key(a)){path.unshift(c);c=parents.get(key(c))??null;}return path;}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,z:p.z+dz};if(!parents.has(key(n))&&world.routeStand(n)&&stepAllowed(world,p,n)){parents.set(key(n),p);queue.push(n);}}}
  return [];
}
