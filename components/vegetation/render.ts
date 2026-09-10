import * as T from 'three';
import {RULES} from '../expedition/config';
import {TEST_PATCH,TEST_TREES,VEGETATION_KEY,validateAsset,type VegetationAsset,type PlantModel} from './format';
import type {VegetationTree} from './layout';

type Point={x:number;z:number};
type Placement=Point&{scale:number;rotation:number};

function geometry(part:PlantModel['parts'][number]){
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(part.positions,3));
  geo.setAttribute('normal',new T.Float32BufferAttribute(part.normals,3));
  geo.setAttribute('color',new T.Float32BufferAttribute(part.colors,3));
  geo.computeBoundingBox();
  return geo;
}

function addInstances(parent:T.Group,model:PlantModel,points:Placement[],material:T.Material,height:(p:Point)=>number){
  if(!points.length)return;
  const matrix=new T.Object3D();
  // Bark, leaves and small details already carry baked vertex colors, so their
  // non-indexed buffers can share one material and one draw call per variant.
  const merged=model.parts.reduce<PlantModel['parts'][number]>((out,part)=>{out.positions.push(...part.positions);out.normals.push(...part.normals);out.colors.push(...part.colors);return out;},{positions:[],normals:[],colors:[]});
  const mesh=new T.InstancedMesh(geometry(merged),material,points.length);
  points.forEach((p,i)=>{matrix.position.set(p.x,height(p),p.z);matrix.rotation.y=p.rotation;matrix.scale.setScalar(p.scale);matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);});
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();parent.add(mesh);
}

/** Editor preview: intentionally keeps the original small 18 × 12 m plot. */
export function buildVegetation(asset:VegetationAsset,height:(p:Point)=>number=()=>0,canStand:(p:Point)=>boolean=()=>true){
  const group=new T.Group();group.name='Baked vegetation editor preview';
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.93,side:T.DoubleSide});
  asset.trees.forEach((model,i)=>addInstances(group,model,TEST_TREES.filter(t=>t.variant===i).map((t,n)=>({...t,rotation:n*2.4})),material,height));
  const grass:Placement[]=[];
  for(let i=0;i<110;i++){const x=TEST_PATCH.x+Math.sin(i*71.31)*8,z=TEST_PATCH.z+Math.cos(i*31.57)*5;if(canStand({x,z}))grass.push({x,z,scale:.7+(i%5)*.15,rotation:i*2.4});}
  addInstances(group,asset.grass,grass,material,height);
  return group;
}

function loadAsset(signal:AbortSignal):Promise<VegetationAsset>{
  try{const raw=localStorage.getItem(VEGETATION_KEY);if(raw&&raw.length<6000000){const saved:unknown=JSON.parse(raw);if(validateAsset(saved))return Promise.resolve(saved);}}catch{}
  return fetch('/vegetation/test-patch.json',{signal}).then(response=>{if(!response.ok)throw new Error('Vegetation asset unavailable');return response.json();}).then((asset:unknown)=>{if(!validateAsset(asset))throw new Error('Invalid vegetation asset');return asset;});
}

/** Playable world: tree/grass geometry is already baked. Only shared geometry,
 * instanced placement and chunk visibility run here. */
export function createVegetationWorld(scene:T.Scene,height:(p:Point)=>number,canStand:(p:Point)=>boolean,trees:VegetationTree[]){
  const chunks=new Map<string,T.Group>(),abort=new AbortController();let disposed=false;
  const chunk=(x:number,z:number)=>{const key=`${Math.floor(x/RULES.chunkSize)},${Math.floor(z/RULES.chunkSize)}`;let group=chunks.get(key);if(!group){group=new T.Group();group.name=`Baked vegetation ${key}`;group.visible=false;chunks.set(key,group);scene.add(group);}return group;};
  void loadAsset(abort.signal).then(asset=>{
    if(disposed)return;
    const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.94,side:T.DoubleSide});
    for(let cx=0;cx<6;cx++)for(let cz=0;cz<3;cz++){
      const group=chunk(cx*RULES.chunkSize,cz*RULES.chunkSize);
      asset.trees.forEach((model,variant)=>{
        const points=trees.filter(t=>t.variant===variant&&Math.floor(t.x/RULES.chunkSize)===cx&&Math.floor(t.z/RULES.chunkSize)===cz).map((t,i)=>({...t,rotation:(i*2.399+t.x*.17)%6.28}));
        addInstances(group,model,points,material,height);
      });
      const grass:Placement[]=[];
      let state=7301+cx*733+cz*1999;
      const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
      for(let i=0;i<105;i++){
        const x=cx*RULES.chunkSize+1+random()*(RULES.chunkSize-2),z=cz*RULES.chunkSize+1+random()*(RULES.chunkSize-2),p={x,z};
        if(z>28&&z<44||!canStand(p)||random()<.16)continue;
        grass.push({x,z,scale:.55+random()*1.05,rotation:random()*Math.PI*2});
      }
      addInstances(group,asset.grass,grass,material,height);
    }
  }).catch(error=>{if(!disposed)console.warn('Vegetation unavailable',error);});
  return {stream(p:Point){const px=Math.floor(p.x/RULES.chunkSize),pz=Math.floor(p.z/RULES.chunkSize);chunks.forEach((group,key)=>{const [x,z]=key.split(',').map(Number);group.visible=Math.abs(x-px)<=RULES.activeRadius&&Math.abs(z-pz)<=RULES.activeRadius;});},dispose(){disposed=true;abort.abort();}};
}
