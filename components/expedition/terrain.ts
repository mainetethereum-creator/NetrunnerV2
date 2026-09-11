import {landscapeDefaults,landscapeDisplacement,type LandscapeState} from './landscape-state.ts';
const authoredPatches=landscapeDefaults();
import type {Point} from './config.ts';
export const northEdge=(x:number)=>2.5+Math.sin(x*.095)*1.5;
export const southEdge=(x:number)=>68-Math.sin(x*.072)*2.2;
export const insideLandscape=(p:Point,r=.34)=>p.x>r&&p.x<144-r&&p.z>northEdge(p.x)+r&&p.z<southEdge(p.x)-r;
// Small surviving soil pockets shared by paving and grass placement.
export function urbanSoilPatch(p:Point){
  return [[17,12,2.5],[43,56,5.8],[77,62,2.8],[101,16,2.4],[132,51,2.7]].some(([x,z,r])=>Math.hypot(p.x-x,(p.z-z)*1.25)<r);
}
export function terrainHeight(p:Point,clearance?:number,displacement=landscapeDisplacement(p,clearance,authoredPatches)){
  const hill=Math.max(0,1-Math.hypot(p.x-43,p.z-56)/7);
  const outside=Math.max(northEdge(p.x)-p.z,p.z-southEdge(p.x),-p.x,p.x-144,0);
  return displacement+1.7*hill*hill*(3-2*hill)+Math.min(6,outside*.55)*( .82+.18*Math.sin(p.x*.31+p.z*.22));
}
// Keep one authored hangar at the industrial edge. The former north hangar
// intersected the new workshop/stack frontage and made that street unreadable.
export const HANGARS=[{x:119,z:60,w:12,d:8,h:5}];

/** Exact samples are memoized and invalidated only by authored edits. No quantization of collisions. */
export function createTerrainHeight(state:LandscapeState){
 const cache=new Map<string,number>();let revision=-1;
 return (p:Point,clearance?:number)=>{
  if(revision!==state.revision){cache.clear();revision=state.revision;}
  const key=p.x+','+p.z;const hit=cache.get(key);if(hit!==undefined)return hit;
  const height=terrainHeight(p,clearance,state.displacement(p,clearance));
  if(cache.size>100000)cache.clear();cache.set(key,height);return height;
 };
}
