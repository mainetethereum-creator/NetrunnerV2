import {registerHooks} from 'node:module';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {REFERENCE_BUILDINGS,isReferenceBuilding} from '../src/assets/reference-buildings.ts';
import * as T from 'three';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL&&!/\.[a-z]+$/i.test(specifier)){const u=new URL(specifier+'.ts',context.parentURL);if(existsSync(u))return next(u.href,context);}return next(specifier,context);}});
const context=new Proxy({measureText:()=>({width:100}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})}, {get:(o,k)=>o[k]??(()=>{})});
globalThis.document={createElement:()=>({width:512,height:512,getContext:()=>context})};
T.TextureLoader.prototype.load=function(){return new T.Texture();};
const {createPropLibrary,PROP_ASSETS}=await import('../components/expedition/prop-assets.ts');
const {createMicrobus}=await import('../components/expedition/microbus.ts');
const library=createPropLibrary();const count=root=>{let triangles=0,bytes=0,draws=0;const geometries=new Set();root.traverse(o=>{if(o.isMesh){draws+=Array.isArray(o.material)?o.geometry.groups.length:1;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);if(!geometries.has(o.geometry)){geometries.add(o.geometry);for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;bytes+=o.geometry.index?.array.byteLength??0;}}});return {triangles,geometryBytes:bytes,draws};};
function countGlb(id){
 const asset=REFERENCE_BUILDINGS.find(a=>a.id===id),data=readFileSync('public'+asset.url);
 const gltf=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
 const primitives=gltf.meshes.flatMap(m=>m.primitives),accessors=new Set();
 let triangles=0;
 for(const primitive of primitives){triangles+=gltf.accessors[primitive.indices].count/3;accessors.add(primitive.indices);Object.values(primitive.attributes).forEach(a=>accessors.add(a));}
 const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},bytes={5121:1,5123:2,5125:4,5126:4};
 const geometryBytes=[...accessors].reduce((sum,id)=>{const a=gltf.accessors[id];return sum+a.count*components[a.type]*bytes[a.componentType];},0);
 return {triangles,geometryBytes,draws:primitives.length};
}
const result=PROP_ASSETS.map(asset=>({id:asset.id,...(isReferenceBuilding(asset.id)?countGlb(asset.id):count(library.create(asset.id)))}));
const scene=new T.Scene();createMicrobus(scene,0,4);result.push({id:'microbus',...count(scene)});mkdirSync('.cache',{recursive:true});writeFileSync('.cache/expedition-asset-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
