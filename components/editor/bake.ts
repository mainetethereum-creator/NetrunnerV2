// Editor/build-time only. Never import this module from a playable scene.
import * as T from 'three';
import {TreePlant,defaultTreeSettings} from '../../vendor/vegetation/tree.ts';
import {windSettings} from '../../vendor/vegetation/wind.ts';
import type {Part,PlantModel,VegetationAsset} from '../vegetation/format.ts';
export type BakeSettings={seed:number;height:number;density:number;gnarl:number};
export const DEFAULT_BAKE:BakeSettings={seed:724,height:3.8,density:40,gnarl:.65};
const rounded=(n:number)=>Math.round(n*100000)/100000;
function flatten(root:T.Object3D):PlantModel{
 root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(root),size=box.getSize(new T.Vector3());
 const normalize=new T.Matrix4().makeTranslation(0,-box.min.y,0);if(!Number.isFinite(size.y))throw new Error('Invalid generated tree');
 const batches=new Map<string,Part>();
 root.traverseVisible(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh||!mesh.geometry||Array.isArray(mesh.material))return;const mat=mesh.material as T.MeshStandardMaterial;if(!mat.visible)return;
  let p=batches.get(mat.uuid);if(!p){p={positions:[],normals:[],colors:[]};batches.set(mat.uuid,p);}
  const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();const pos=geo.getAttribute('position'),normal=geo.getAttribute('normal');
  const inst=mesh as T.InstancedMesh,count=inst.isInstancedMesh?inst.count:1;
  for(let i=0;i<count;i++){const m=mesh.matrixWorld.clone(),instance=new T.Matrix4(),color=mat.color.clone();if(inst.isInstancedMesh){inst.getMatrixAt(i,instance);m.multiply(instance);if(inst.instanceColor){const c=new T.Color();inst.getColorAt(i,c);color.multiply(c);}}
   m.premultiply(normalize);const nmat=new T.Matrix3().getNormalMatrix(m);for(let j=0;j<pos.count;j++){const v=new T.Vector3().fromBufferAttribute(pos,j).applyMatrix4(m),n=new T.Vector3().fromBufferAttribute(normal,j).applyNormalMatrix(nmat);p.positions.push(rounded(v.x),rounded(v.y),rounded(v.z));p.normals.push(rounded(n.x),rounded(n.y),rounded(n.z));p.colors.push(rounded(color.r*.38),rounded(color.g*.48),rounded(color.b*.36));}}
  geo.dispose();
 });
 const parts=[...batches.values()].filter(p=>p.positions.length);return {parts,triangles:parts.reduce((n,p)=>n+p.positions.length/9,0)};
}
export function bakeVegetation(settings:BakeSettings):VegetationAsset{
 windSettings.strength=0;
 const trees=Array.from({length:3},(_,i)=>{const plant=new TreePlant({...defaultTreeSettings,quality:'low',limbs:3,splits:2,trunkHeight:.85,trunkGirth:.14,clumpDensity:Math.max(8,Math.min(60,settings.density)),gnarl:settings.gnarl,vineCount:0,figDensity:0,leafHue:.24},settings.seed+i*101);plant.finishGrowth();plant.updateLeaves(0);const box=new T.Box3().setFromObject(plant.group);plant.group.scale.setScalar(settings.height*(.9+i*.1)/box.getSize(new T.Vector3()).y);const model=flatten(plant.group);plant.dispose();return model;});
 const grass=new T.Group();const material=new T.MeshStandardMaterial({color:'#66734c',roughness:1,side:T.DoubleSide});
 for(let i=0;i<9;i++){const angle=i*2.4,x=Math.cos(angle)*.16,z=Math.sin(angle)*.16,h=.25+(i%4)*.09;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([x-.025,0,z,x+.025,0,z,x+Math.cos(angle)*.12,h,z+Math.sin(angle)*.12],3));g.computeVertexNormals();grass.add(new T.Mesh(g,material));}
 const bakedGrass=flatten(grass);grass.children.forEach(o=>(o as T.Mesh).geometry.dispose());material.dispose();
 return {version:1,seed:settings.seed,trees,grass:bakedGrass};
}
