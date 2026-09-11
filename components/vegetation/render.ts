import * as T from 'three';
import {loadRuntimeTrees} from './baked-runtime';
import {RULES} from '../expedition/config';
import {TEST_PATCH,TEST_TREES,type VegetationAsset,type PlantModel} from './format';
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

// Share the baked GPU buffers across all streamed chunks.
function modelGeometry(model:PlantModel){
  const merged:PlantModel['parts'][number]={positions:[],normals:[],colors:[]};
  for(const part of model.parts){for(const value of part.positions)merged.positions.push(value);for(const value of part.normals)merged.normals.push(value);for(const value of part.colors)merged.colors.push(value);}
  return geometry(merged);
}
function addInstances(parent:T.Group,model:PlantModel,points:Placement[],material:T.Material,height:(p:Point)=>number,sharedGeometry?:T.BufferGeometry){
  if(!points.length)return;
  const matrix=new T.Object3D();
  // Bark, leaves and small details already carry baked vertex colors, so their
  // non-indexed buffers can share one material and one draw call per variant.
  const mesh=new T.InstancedMesh(sharedGeometry??modelGeometry(model),material,points.length);
  points.forEach((p,i)=>{matrix.position.set(p.x,height(p),p.z);matrix.rotation.y=p.rotation;matrix.scale.setScalar(p.scale);matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);});
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();parent.add(mesh);
}

/** Editor preview: intentionally keeps the original small 18 × 12 m plot. */
export function buildVegetation(asset:VegetationAsset,height:(p:Point)=>number=()=>0,canStand:(p:Point)=>boolean=()=>true){
  const group=new T.Group();group.name='Baked vegetation editor preview';
  const material=new T.MeshStandardMaterial({color:'#7f8b70',vertexColors:true,roughness:.93,side:T.DoubleSide});
  asset.trees.forEach((model,i)=>addInstances(group,model,TEST_TREES.filter(t=>t.variant===i).map((t,n)=>({...t,rotation:n*2.4})),material,height));
  const grass:Placement[]=[];
  for(let i=0;i<110;i++){const x=TEST_PATCH.x+Math.sin(i*71.31)*8,z=TEST_PATCH.z+Math.cos(i*31.57)*5;if(canStand({x,z}))grass.push({x,z,scale:.7+(i%5)*.15,rotation:i*2.4});}
  addInstances(group,asset.grass,grass,material,height);
  return group;
}

/** Playable world: tree/grass geometry is already baked. Only shared geometry,
 * instanced placement and chunk visibility run here. */
export function createVegetationWorld(scene:T.Scene,height:(p:Point)=>number,_canStand:(p:Point)=>boolean,trees:VegetationTree[]){
  const chunks=new Map<string,T.Group>(),abort=new AbortController();let disposed=false;
  const wind={value:0};
  const atlas=new T.TextureLoader().load('/game/props/salvage/material-atlas.webp');atlas.colorSpace=T.SRGBColorSpace;atlas.anisotropy=8;
  const chunk=(x:number,z:number)=>{const key=`${Math.floor(x/RULES.chunkSize)},${Math.floor(z/RULES.chunkSize)}`;let group=chunks.get(key);if(!group){group=new T.Group();group.name=`Baked vegetation ${key}`;group.visible=false;chunks.set(key,group);scene.add(group);}return group;};
  void loadRuntimeTrees(abort.signal).then(treeGeometry=>{
    if(disposed){treeGeometry.forEach(g=>g.dispose());return;}
    const material=new T.MeshStandardMaterial({color:'#929381',vertexColors:true,roughness:.9,side:T.DoubleSide});
    material.onBeforeCompile=shader=>{
      shader.uniforms.vegetationAtlas={value:atlas};shader.uniforms.windTime=wind;
      shader.vertexShader=`uniform float windTime;varying vec3 plantLocal;varying float plantLeaf;\n${shader.vertexShader}`.replace('#include <begin_vertex>',`#include <begin_vertex>
        plantLocal=position;plantLeaf=smoothstep(.015,.11,color.g-color.r);
        float phase=instanceMatrix[3].x*.7+instanceMatrix[3].z*.43;
        transformed.x+=sin(windTime*1.3+position.y*.7+phase)*.028*plantLeaf*min(position.y,5.);
        transformed.z+=cos(windTime*.9+phase+position.x)*.018*plantLeaf*min(position.y,5.);
      `);
      shader.fragmentShader=`uniform sampler2D vegetationAtlas;varying vec3 plantLocal;varying float plantLeaf;\n${shader.fragmentShader}`.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 timberUV=fract(vec2((plantLocal.x+plantLocal.z)*1.9,plantLocal.y*.24));
        vec3 timber=texture2D(vegetationAtlas,vec2(.004,.671)+timberUV*.322).rgb;
        float timberRelief=dot(timber,vec3(.299,.587,.114));
        diffuseColor.rgb*=mix(.35+timberRelief*2.1, .84, plantLeaf);
        diffuseColor.rgb*=mix(.55,1.,smoothstep(0.,1.1,plantLocal.y));
      `);
    };
    material.customProgramCacheKey=()=> 'expedition-vegetation-weathered-v1';

    for(let cx=0;cx<6;cx++)for(let cz=0;cz<3;cz++){
      const group=chunk(cx*RULES.chunkSize,cz*RULES.chunkSize);
      treeGeometry.forEach((geometry,variant)=>{
        const points=trees.filter(t=>t.variant===variant&&Math.floor(t.x/RULES.chunkSize)===cx&&Math.floor(t.z/RULES.chunkSize)===cz).map((t,i)=>({...t,rotation:(i*2.399+t.x*.17)%6.28}));
        addInstances(group,{parts:[],triangles:0},points,material,height,geometry);
      });
      // GrassSystemThreeJS owns playable grass; GitHub trees stay.
    }
  }).catch(error=>{if(!disposed)console.warn('Vegetation unavailable',error);});
  return {update(time:number){wind.value=time;},stream(p:Point){const px=Math.floor(p.x/RULES.chunkSize),pz=Math.floor(p.z/RULES.chunkSize);chunks.forEach((group,key)=>{const [x,z]=key.split(',').map(Number);group.visible=Math.abs(x-px)<=RULES.activeRadius&&Math.abs(z-pz)<=RULES.activeRadius;});},dispose(){disposed=true;abort.abort();atlas.dispose();}};
}
