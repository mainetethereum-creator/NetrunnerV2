import type {Rect} from '../expedition/config.ts';
import {POIS,EXTRACTIONS} from '../expedition/config.ts';
import {insideLandscape,terrainHeight} from '../expedition/terrain.ts';
import {TEST_TREES} from './format.ts';

export type VegetationTree={x:number;z:number;variant:number;scale:number};

/** Stable layout for the playable map. It is generated once while the module
 * loads, then used both by navigation and by the baked-instance renderer. */
export function makeVegetationTrees(blockers:Rect[]):VegetationTree[]{
  const trees:VegetationTree[]=[...TEST_TREES];
  let seed=98431;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let attempt=0;attempt<900&&trees.length<46;attempt++){
    const x=5+random()*134,z=6+random()*59,p={x,z};
    // Preserve the asphalt highway and its sight lines. Groves live behind the
    // roadside structures, on verges and around the irregular map boundary.
    if(z>27.5&&z<45||!insideLandscape(p,1.15)||terrainHeight(p)>.65)continue;
    if(blockers.some(b=>Math.abs(x-b.x)<b.w/2+1.8&&Math.abs(z-b.z)<b.d/2+1.8))continue;
    if([...POIS,...EXTRACTIONS].some(o=>Math.hypot(x-o.x,z-o.z)<4.8))continue;
    if(trees.some(t=>Math.hypot(x-t.x,z-t.z)<4.2))continue;
    trees.push({x,z,variant:Math.floor(random()*3),scale:.75+random()*.48});
  }
  return trees;
}
