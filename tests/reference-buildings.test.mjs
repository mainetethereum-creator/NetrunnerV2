import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {REFERENCE_BUILDINGS} from '../src/assets/reference-buildings.ts';
import {createReferenceBuildingLibrary} from '../src/renderer/three/reference-building-library.ts';
import {createConcreteMaterial} from '../src/renderer/three/cold-concrete.ts';

function decode(asset) {
 const file=readFileSync(new URL('../public'+asset.url,import.meta.url));
 assert.equal(file.toString('ascii',0,4),'glTF');
 assert.equal(file.readUInt32LE(4),2);
 assert.equal(file.readUInt32LE(8),file.length);
 const json=JSON.parse(file.subarray(20,20+file.readUInt32LE(12)).toString());
 return {file,json};
}

test('three reference GLBs are grounded, complete, textured and inside the low-poly budget',async()=>{
 const loader=new GLTFLoader();
 // Exercise the real glTF geometry/material parser without a browser image decoder.
 loader.register(()=>({name:'TEST_IMAGE_DECODER',loadTexture:()=>Promise.resolve(new T.Texture())}));
 for(const asset of REFERENCE_BUILDINGS.filter(asset=>asset.id.startsWith('building-reference-'))){
  const {file,json}=decode(asset);
  assert.ok(file.length<3*1024*1024,`${asset.id}: transfer budget`);
  assert.equal(json.images.length,2,'separate embedded concrete and metal surfaces');
  assert.ok(json.images.every(i=>i.bufferView!==undefined&&!i.uri));
  assert.ok(!json.animations?.length&&!json.cameras?.length);
  assert.ok(!json.extensionsUsed?.includes('KHR_lights_punctual'));
  const gltf=await loader.parseAsync(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),'');
  const box=new T.Box3().setFromObject(gltf.scene),size=box.getSize(new T.Vector3());
  assert.ok(Math.abs(box.min.y)<.001,'grounded origin');
  assert.ok(Math.abs(box.min.x+box.max.x)<.001,'centred X including protrusions');
  assert.ok(Math.abs(box.min.z+box.max.z)<.001,'centred Z including stairs');
  assert.ok(size.x>8&&size.x<23&&size.y>7&&size.y<23&&size.z>6&&size.z<14);
  if(asset.id==='building-reference-administration'){
   assert.ok(size.x<13.3&&size.y<13.3&&size.z<8.1,'compact Base-sized administration');
  }
  let triangles=0,draws=0;
  gltf.scene.traverse(o=>{
   if(!o.isMesh)return;
   draws++;const g=o.geometry;
   assert.ok(g.index);assert.ok(g.attributes.normal);assert.ok(g.attributes.uv);
   triangles+=g.index.count/3;
   for(const a of Object.values(g.attributes))assert.ok(Array.from(a.array).every(Number.isFinite));
   for(const index of g.index.array)assert.ok(index<g.attributes.position.count);
  });
  assert.ok(triangles>4000&&triangles<12000,`${asset.id}: ${triangles} triangles`);
  assert.ok(draws<=8,`${asset.id}: ${draws} material draws`);
  assert.ok(json.materials.some(m=>m.emissiveFactor?.some(v=>v>0)),'portable emission');
  const concrete=json.materials.find(m=>m.name==='CBR1_Concrete');
  assert.ok(concrete.pbrMetallicRoughness.baseColorTexture);
  assert.ok(concrete.pbrMetallicRoughness.baseColorFactor[0]<.5,'Blender tint survives export');
 }
});

function fixture(){
 const scene=new T.Group(),geometry=new T.BoxGeometry(),texture=new T.Texture();
 const material=new T.MeshStandardMaterial({map:texture});
 scene.add(new T.Mesh(geometry,material));
 return {scene,geometry,material,texture};
}

test('imported concrete uses the legacy shader, metric UVs and one shared atlas with safe disposal',async()=>{
 const atlas=new T.Texture(),oldTextures=[],originalMaterials=[];
 let atlasLoads=0;
 const models=REFERENCE_BUILDINGS.slice(0,2).map(()=>{
  const model=fixture();model.geometry.scale(8.4,5.6,.3);
  const imported=new T.BufferGeometry().copy(model.geometry);model.geometry.dispose();
  model.geometry=imported;model.scene.children[0].geometry=imported;
  model.material.name='CBR1_Concrete';oldTextures.push(model.texture);originalMaterials.push(model.material);
  return model;
 });
 const library=createReferenceBuildingLibrary(4,async()=>models.shift(),async()=>{atlasLoads++;return atlas;});
 let oldDisposed=0;[...oldTextures,...originalMaterials].forEach(r=>r.addEventListener('dispose',()=>oldDisposed++));
 await Promise.all(REFERENCE_BUILDINGS.slice(0,2).map(a=>library.prepare(a.id)));
 const a=library.create(REFERENCE_BUILDINGS[0].id).children[0],b=library.create(REFERENCE_BUILDINGS[1].id).children[0];
 assert.equal(atlasLoads,1);assert.equal(a.material,b.material);assert.equal(a.material.map,atlas);assert.equal(a.material.bumpMap,atlas);
 assert.equal(a.material.bumpScale,.012);assert.equal(oldDisposed,4);assert.equal(atlas.colorSpace,T.SRGBColorSpace);
 const original=createConcreteMaterial(atlas),shader=()=>({vertexShader:'#include <common>\n#include <uv_vertex>',fragmentShader:'#include <common>\n#include <map_pars_fragment>\n#include <map_fragment>\n#include <roughnessmap_fragment>\n#include <bumpmap_pars_fragment>'});
 const actual=shader(),expected=shader();a.material.onBeforeCompile(actual);original.onBeforeCompile(expected);assert.deepEqual(actual,expected);original.dispose();
 assert.ok(Math.abs(a.material.color.r-new T.Color(0xb5b5b5).r*.75)<1e-8);
 const g=a.geometry,normal=g.attributes.normal,uv=g.attributes.uv,position=g.attributes.position;
 const front=Array.from({length:position.count},(_,i)=>i).filter(i=>normal.getZ(i)>.99);
 const span=values=>Math.max(...values)-Math.min(...values);
 assert.ok(Math.abs(span(front.map(i=>uv.getX(i)))-span(front.map(i=>position.getX(i)))/2.8)<1e-6,'texture density follows metres, not facade bounds');
 assert.ok(g.attributes.concreteSurface);
 let materialDisposals=0,atlasDisposals=0;a.material.addEventListener('dispose',()=>materialDisposals++);atlas.addEventListener('dispose',()=>atlasDisposals++);
 library.dispose();library.dispose();assert.equal(materialDisposals,1);assert.equal(atlasDisposals,1);
});

test('repeated city surface maps share one GPU texture and retain embedded fallback',async()=>{
 const shared=new T.Texture(),models=[fixture(),fixture()];
 for(const model of models){model.texture.name='surface';model.material.name='CBJ1_RoofMetal';}
 let loads=0;
 const library=createReferenceBuildingLibrary(4,async()=>models.shift(),async()=>new T.Texture(),async()=>new T.Texture(),false,async()=>{loads++;return shared;});
 await Promise.all(REFERENCE_BUILDINGS.slice(0,2).map(asset=>library.prepare(asset.id)));
 const a=library.create(REFERENCE_BUILDINGS[0].id).children[0].material;
 const b=library.create(REFERENCE_BUILDINGS[1].id).children[0].material;
 assert.equal(loads,1);assert.equal(a.map,shared);assert.equal(b.map,shared);assert.equal(shared.colorSpace,T.SRGBColorSpace);
 let disposals=0;shared.addEventListener('dispose',()=>disposals++);library.dispose();assert.equal(disposals,1);
 const fallback=fixture();fallback.texture.name='surface';
 const compatible=createReferenceBuildingLibrary(4,async()=>fallback,async()=>new T.Texture(),async()=>new T.Texture(),false,async()=>{throw new Error('unsupported');});
 await compatible.prepare(REFERENCE_BUILDINGS[0].id);
 assert.equal(compatible.create(REFERENCE_BUILDINGS[0].id).children[0].material.map,fallback.texture);
 compatible.dispose();
});

test('disposal during concrete atlas loading releases both the late atlas and parsed GLB',async()=>{
 let resolveAtlas;const model=fixture(),atlas=new T.Texture();model.material.name='CBR1_Concrete';
 const counts=[0,0,0,0];[model.geometry,model.material,model.texture,atlas].forEach((r,i)=>r.addEventListener('dispose',()=>counts[i]++));
 const library=createReferenceBuildingLibrary(4,async()=>model,()=>new Promise(r=>resolveAtlas=r));
 const pending=library.prepare(REFERENCE_BUILDINGS[0].id);await new Promise(setImmediate);
 library.dispose();resolveAtlas(atlas);await assert.rejects(pending,/disposed/);
 assert.deepEqual(counts,[1,1,1,1]);
});

test('GLB preparation coalesces requests and placements share resources without sharing transforms',async()=>{
 let resolve,calls=0;const model=fixture();
 const library=createReferenceBuildingLibrary(4,()=>{calls++;return new Promise(r=>resolve=r);});
 const id=REFERENCE_BUILDINGS[0].id;
 assert.throws(()=>library.create(id),/Prepare/);
 const first=library.prepare(id),second=library.prepare(id);assert.equal(first,second);assert.equal(calls,1);
 resolve(model);await first;
 const a=library.create(id),b=library.create(id);a.position.x=9;
 assert.equal(b.position.x,0);assert.equal(a.children[0].geometry,b.children[0].geometry);
 assert.equal(a.children[0].material,b.children[0].material);
 assert.equal(a.children[0].castShadow,true);assert.equal(model.texture.anisotropy,4);
 const counts=[0,0,0];[model.geometry,model.material,model.texture].forEach((r,i)=>r.addEventListener('dispose',()=>counts[i]++));
 library.dispose();library.dispose();assert.deepEqual(counts,[1,1,1]);
 assert.throws(()=>library.create(id),/disposed/);
});

test('late GLB completion after disposal releases resources and never creates a prototype',async()=>{
 let resolve;const model=fixture(),counts=[0,0,0];
 [model.geometry,model.material,model.texture].forEach((r,i)=>r.addEventListener('dispose',()=>counts[i]++));
 const library=createReferenceBuildingLibrary(4,()=>new Promise(r=>resolve=r));
 const pending=library.prepare(REFERENCE_BUILDINGS[0].id);
 library.dispose();resolve(model);await assert.rejects(pending,/disposed/);
 assert.deepEqual(counts,[1,1,1]);assert.equal(library.isReady(REFERENCE_BUILDINGS[0].id),false);
});

test('failed model preparation can be retried',async()=>{
 let calls=0;const library=createReferenceBuildingLibrary(4,()=>++calls===1?Promise.reject(new Error('offline')):Promise.resolve(fixture()));
 await assert.rejects(library.prepare(REFERENCE_BUILDINGS[0].id),/offline/);
 await library.prepare(REFERENCE_BUILDINGS[0].id);assert.equal(calls,2);library.dispose();
});

test('garden signs are opt-in and late shared sign loads dispose exactly once',async()=>{
 const make=()=>{const m=fixture();m.geometry.scale(5,16,4);m.material.name='CBR1_Concrete';return m;};
 const ordinary=createReferenceBuildingLibrary(4,async()=>make(),async()=>new T.Texture(),async()=>assert.fail('other maps must not request garden signs'));
 await ordinary.prepare('building-urban-office');
 assert.equal(ordinary.create('building-urban-office').getObjectByName('Garden district / neon blade'),undefined);ordinary.dispose();
 let resolveSign,signLoads=0;const atlas=new T.Texture(),sign=new T.Texture(),models=[make(),make()];
 const library=createReferenceBuildingLibrary(4,async()=>models.shift(),async()=>atlas,()=>{signLoads++;return new Promise(r=>resolveSign=r);},true);
 let atlasDisposals=0,signDisposals=0;atlas.addEventListener('dispose',()=>atlasDisposals++);sign.addEventListener('dispose',()=>signDisposals++);
 const pending=[library.prepare('building-urban-office'),library.prepare('building-corner-chamfer')];
 await new Promise(setImmediate);library.dispose();resolveSign(sign);
 const outcomes=await Promise.allSettled(pending);
 assert.ok(outcomes.every(r=>r.status==='rejected'));assert.equal(signLoads,1);assert.equal(signDisposals,1);assert.equal(atlasDisposals,1);
});
