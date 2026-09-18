import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {ASSET_URLS} from '../src/assets/registry.ts';
import {REFERENCE_BUILDINGS} from '../src/assets/reference-buildings.ts';
import {createReferenceBuildingLibrary} from '../src/renderer/three/reference-building-library.ts';

const bytes=readFileSync(new URL('../public'+ASSET_URLS.referenceBuildings.glassCorner,import.meta.url));
const jsonLength=bytes.readUInt32LE(12);
const gltf=JSON.parse(bytes.subarray(20,20+jsonLength));
const binary=bytes.subarray(28+jsonLength);
const sha=data=>createHash('sha256').update(data).digest('hex');
function parse(){
 const loader=new GLTFLoader();
 loader.register(()=>({name:'TEST_IMAGE_DECODER',loadTexture:()=>Promise.resolve(new T.Texture())}));
 return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}

test('corner media preserves the approved source and is registered in the shared editor catalogue',()=>{
 assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);
 const media=gltf.materials.find(m=>m.name==='CBC1_ApprovedMedia');
 const image=gltf.textures[media.pbrMetallicRoughness.baseColorTexture.index].source;
 assert.equal(image,gltf.textures[media.emissiveTexture.index].source);
 const view=gltf.bufferViews[gltf.images[image].bufferView];
 const embedded=binary.subarray(view.byteOffset,view.byteOffset+view.byteLength);
 const source=readFileSync(new URL('../output/building-concepts/2026-09-18-glass-neon-v1/02-glass-corner.png',import.meta.url));
 assert.equal(sha(embedded),sha(source),'original artwork is not regenerated or recompressed');
 assert.ok(REFERENCE_BUILDINGS.some(a=>a.id==='building-glass-corner'&&a.url===ASSET_URLS.referenceBuildings.glassCorner));
 assert.ok(gltf.materials.some(m=>m.name==='CBR1_Concrete_GlassCorner'),'uses the shared dark concrete adapter');
 assert.ok(gltf.materials.some(m=>m.name==='CBC1_HologramCyan'&&m.emissiveFactor.some(v=>v>0)));
 assert.ok(gltf.materials.every(m=>!m.alphaMode||m.alphaMode==='OPAQUE'),'glass and open-stroke hologram avoid transparent overdraw');
});

test('actual corner GLB has closed elevations, grounded bounds and an economical mesh/texture budget',async()=>{
 assert.ok(bytes.length<3.3*1024*1024);
 assert.equal(gltf.scenes.length,1);assert.equal(gltf.scenes[0].nodes.length,1);
 assert.ok(!gltf.animations?.length&&!gltf.cameras?.length&&!gltf.skins?.length);
 assert.ok(!gltf.extensionsUsed?.includes('KHR_lights_punctual'));
 assert.equal(gltf.images.length,3);assert.ok(gltf.images.every(i=>i.bufferView!==undefined&&!i.uri));
 const {scene}=await parse();scene.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(scene),size=bounds.getSize(new T.Vector3());
 assert.ok(Math.abs(bounds.min.y)<1e-4);
 assert.ok(Math.abs(bounds.min.x+bounds.max.x)<1e-4&&Math.abs(bounds.min.z+bounds.max.z)<1e-4);
 assert.ok(Math.abs(size.x-14.9)<.01&&Math.abs(size.z-11.427)<.01&&Math.abs(size.y-21.135)<.01);
 let triangles=0,draws=0;
 scene.traverse(o=>{
  if(!o.isMesh)return;
  draws++;const g=o.geometry;assert.ok(g.index&&g.attributes.uv&&g.attributes.normal);
  triangles+=g.index.count/3;
  for(const attr of Object.values(g.attributes))assert.ok(Array.from(attr.array).every(Number.isFinite));
  for(const i of g.index.array)assert.ok(i<g.attributes.position.count);
 });
 assert.ok(triangles<=9500,`${triangles} triangles`);assert.ok(draws<=10,`${draws} draws`);
 for(const y of [2,12])for(const [x,z] of [[25,0],[-25,0],[0,25],[0,-25]]){
  const origin=new T.Vector3(x,y,z),dir=new T.Vector3(0,y,0).sub(origin).normalize();
  assert.ok(new T.Raycaster(origin,dir).intersectObject(scene,true).length,`closed from ${x},${y},${z}`);
 }
});

test('corner placements share GPU resources, retain independent transforms and release loaded meshes once',async()=>{
 let loads=0;
 const library=createReferenceBuildingLibrary(4,async()=>{loads++;return parse();},async()=>new T.Texture());
 await Promise.all([library.prepare('building-glass-corner'),library.prepare('building-glass-corner')]);
 assert.equal(loads,1);
 const first=library.create('building-glass-corner'),second=library.create('building-glass-corner');
 first.position.x=19;assert.equal(second.position.x,0);
 assert.equal(first.children[0].geometry,second.children[0].geometry);
 assert.equal(first.children[0].material,second.children[0].material);
 const resources=new Set();first.traverse(o=>{if(o.isMesh){resources.add(o.geometry);resources.add(o.material);}});
 const disposed=new Map();for(const resource of resources)resource.addEventListener('dispose',()=>disposed.set(resource,(disposed.get(resource)??0)+1));
 library.dispose();library.dispose();
 assert.equal(disposed.size,resources.size);assert.ok([...disposed.values()].every(n=>n===1));
});
