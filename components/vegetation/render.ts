import * as T from 'three';
import {TEST_PATCH,TEST_TREES,VEGETATION_KEY,validateAsset,type VegetationAsset,type PlantModel} from './format';
export function buildVegetation(asset:VegetationAsset,height:(p:{x:number;z:number})=>number=()=>0,canStand:(p:{x:number;z:number})=>boolean=()=>true){
 const group=new T.Group();group.name='Baked vegetation test plot';const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.93,side:T.DoubleSide});const matrix=new T.Object3D();
 const place=(model:PlantModel,points:{x:number;z:number;scale:number}[])=>{if(!points.length)return;for(const part of model.parts){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(part.positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(part.normals,3));geo.setAttribute('color',new T.Float32BufferAttribute(part.colors,3));const mesh=new T.InstancedMesh(geo,material,points.length);points.forEach((p,i)=>{matrix.position.set(p.x,height(p),p.z);matrix.rotation.y=i*2.4;matrix.scale.setScalar(p.scale);matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);});mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);}};
 asset.trees.forEach((model,i)=>place(model,TEST_TREES.filter(t=>t.variant===i)));
 const grass=[];for(let i=0;i<110;i++){const x=TEST_PATCH.x+Math.sin(i*71.31)*8,z=TEST_PATCH.z+Math.cos(i*31.57)*5;if(canStand({x,z}))grass.push({x,z,scale:.7+(i%5)*.15});}place(asset.grass,grass);
 return group;
}
export function createVegetationPatch(scene:T.Scene,height:(p:{x:number;z:number})=>number,canStand:(p:{x:number;z:number})=>boolean){
 let group:T.Group|null=null,disposed=false;const abort=new AbortController();
 const load=async()=>{let asset:unknown;try{const raw=localStorage.getItem(VEGETATION_KEY);if(raw&&raw.length<6000000){const saved=JSON.parse(raw);if(validateAsset(saved))asset=saved;}}catch{}
  if(!asset){const response=await fetch('/vegetation/test-patch.json',{signal:abort.signal});if(!response.ok)throw new Error('Vegetation asset unavailable');asset=await response.json();}
  if(disposed||!validateAsset(asset))return;group=buildVegetation(asset,height,canStand);scene.add(group);
 };
 void load().catch(error=>{if(!disposed)console.warn('Vegetation preview unavailable',error);});
 return {stream(p:{x:number;z:number}){if(group)group.visible=Math.hypot(p.x-TEST_PATCH.x,p.z-TEST_PATCH.z)<48;},dispose(){disposed=true;abort.abort();}};
}
