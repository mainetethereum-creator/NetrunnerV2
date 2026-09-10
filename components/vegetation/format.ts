export type Part={positions:number[];normals:number[];colors:number[]};
export type PlantModel={parts:Part[];triangles:number};
export type VegetationAsset={version:1;seed:number;trees:PlantModel[];grass:PlantModel};
export const VEGETATION_KEY='netrunner.editor.vegetation.v1';
export const TEST_PATCH={x:22,z:55,w:18,d:12};
export const TEST_TREES=[{x:16,z:51,variant:0,scale:1},{x:26,z:51,variant:1,scale:1.1},{x:18,z:59,variant:2,scale:.95},{x:28,z:59,variant:0,scale:.9}];
export function validateAsset(value:unknown):value is VegetationAsset{
 if(!value||typeof value!=='object')return false;const a=value as VegetationAsset;
 if(a.version!==1||!Number.isFinite(a.seed)||!Array.isArray(a.trees)||a.trees.length!==3||!a.grass)return false;
 let total=0;for(const model of [...a.trees,a.grass]){if(!Array.isArray(model.parts)||!model.parts.length||model.parts.length>4)return false;for(const p of model.parts){if(!Array.isArray(p.positions)||p.positions.length%9!==0||!p.positions.length||p.positions.length>180000||!Array.isArray(p.normals)||!Array.isArray(p.colors)||p.normals.length!==p.positions.length||p.colors.length!==p.positions.length)return false;for(const v of p.positions)if(!Number.isFinite(v)||Math.abs(v)>30)return false;for(const v of [...p.normals,...p.colors])if(!Number.isFinite(v)||Math.abs(v)>1.01)return false;total+=p.positions.length/9;}}
 return total<=30000;
}
