import type {Point} from './config.ts';
export const northEdge=(x:number)=>2.5+Math.sin(x*.095)*1.5;
export const southEdge=(x:number)=>68-Math.sin(x*.072)*2.2;
export const insideLandscape=(p:Point,r=.34)=>p.x>r&&p.x<144-r&&p.z>northEdge(p.x)+r&&p.z<southEdge(p.x)-r;
export function terrainHeight(p:Point){
  const hill=Math.max(0,1-Math.hypot(p.x-43,p.z-56)/7);
  const outside=Math.max(northEdge(p.x)-p.z,p.z-southEdge(p.x),-p.x,p.x-144,0);
  return 1.7*hill*hill*(3-2*hill)+Math.min(6,outside*.55)*( .82+.18*Math.sin(p.x*.31+p.z*.22));
}
export const HANGARS=[{x:73,z:16,w:13,d:9,h:5.5},{x:119,z:60,w:12,d:8,h:5}];
