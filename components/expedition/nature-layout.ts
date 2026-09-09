import {POIS,EXTRACTIONS,type Rect} from './config.ts';
import {insideLandscape,terrainHeight} from './terrain.ts';
export const FOUNTAIN={x:49,z:22,w:7.4,d:7.4};
export const RUIN_WALLS=[{x:40,z:20,w:.85,d:9},{x:51,z:15,w:11,d:.85},{x:94,z:61,w:.85,d:7},{x:132,z:16,w:9,d:.85}];
export type Tree={x:number;z:number;scale:number;seed:number};
export function makeTrees(blockers:Rect[]):Tree[]{
  const trees:Tree[]=[];let seed=407;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<520;i++){
    const x=5+random()*133,z=7+random()*57,p={x,z};
    if(!insideLandscape(p,1)||z>29&&z<44||terrainHeight(p)>.4)continue;
    if(blockers.some(b=>Math.abs(x-b.x)<b.w/2+1.7&&Math.abs(z-b.z)<b.d/2+1.7))continue;
    if([...POIS,...EXTRACTIONS].some(o=>Math.hypot(x-o.x,z-o.z)<4))continue;
    if(trees.some(t=>Math.hypot(x-t.x,z-t.z)<3.2))continue;
    trees.push({x,z,scale:.75+random()*.65,seed:i+1});if(trees.length>=85)break;
  }return trees;
}
