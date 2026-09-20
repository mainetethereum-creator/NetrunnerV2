import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {Reflector} from 'three/examples/jsm/objects/Reflector.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {disposeObjectTree} from '../src/renderer/three/dispose.ts';
import {createCanal} from '../src/renderer/environment/canal.ts';
import {createCanalWater} from '../src/renderer/environment/canal-water.ts';
import {CANAL,CANAL_SOLIDS} from '../src/renderer/environment/canal-layout.ts';
import {canStand,findPath,SPAWN} from '../components/base/world.ts';

const roots=['Embankment','CanalRailing','CanalLantern','UnfinishedBridge','ForestGate','ConstructionSupplies','IvyDrape','CanalReeds','BankFern','BankRocks','NearBank'];
function fixture() {
  const scene=new T.Group(),resources=[];
  const texture=new T.Texture();resources.push(texture);
  const materials=['Masonry','Paving','Cedar','Iron','Foliage','Washi','Black','Lettering','Amber','Safety'].map(name=>{
    const mat=new T.MeshStandardMaterial({map:texture});mat.name=`CANAL_${name}`;resources.push(mat);return mat;
  });
  for(const name of roots) {
    const root=new T.Group();root.name=name;scene.add(root);
    for(const mat of name==='Embankment'?materials:[materials[0]]) {
      const geo=new T.BoxGeometry(1,1,1);resources.push(geo);const mesh=new T.Mesh(geo,mat);mesh.name=`${name}_${mat.name}`;root.add(mesh);
    }
  }
  return {scene,resources};
}
const watch=resources=>resources.map(r=>{const count={n:0};r.addEventListener('dispose',()=>count.n++);return count;});

test('Blender canal kit embeds mapped materials and a real open deck gap',async()=>{
  const bytes=readFileSync('public/game/canal/v1/canal-kit.glb');
  assert.ok(bytes.length<4_600_000);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  for(const name of roots)assert.ok(doc.nodes.some(n=>n.name===name),name);
  assert.ok(doc.images.every(i=>i.mimeType==='image/webp'&&i.bufferView!==undefined));
  assert.ok(doc.materials.filter(m=>m.normalTexture).length>=4);
  const leaves=doc.materials.find(m=>m.name==='CANAL_Foliage');assert.equal(leaves.alphaMode,'MASK');assert.equal(leaves.doubleSided,true);
  assert.ok(!doc.animations?.length&&!doc.cameras?.length&&!doc.skins?.length);
  for(const accessor of doc.accessors)for(const n of [...accessor.min??[],...accessor.max??[]])assert.ok(Number.isFinite(n));
  const loader=new GLTFLoader();
  loader.register(()=>({name:'EXT_texture_webp',loadTexture:async()=>new T.Texture()}));
  const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
  const bridge=scene.getObjectByName('UnfinishedBridge');bridge.position.set(0,0,0);scene.updateMatrixWorld(true);
  const ray=new T.Raycaster(new T.Vector3(.28,5,-5.85),new T.Vector3(0,-1,0));
  assert.ok(ray.intersectObject(bridge,true).length,'intact park-side deck');
  ray.set(new T.Vector3(.85,5,2.35),new T.Vector3(0,-1,0));
  assert.equal(ray.intersectObject(bridge,true).length,0,'open water between exposed joists');
  disposeObjectTree(scene);
});

test('the future forest, bridge gap and water cannot be entered, park routes remain open',()=>{
  assert.equal(CANAL.forestOpen,false);
  for(const z of [34,35,41,48,51])for(const x of [-30,0,CANAL.bridgeX,30])assert.equal(canStand({x,z}),false);
  for(const solid of CANAL_SOLIDS)assert.equal(canStand(solid),false);
  assert.equal(findPath(SPAWN,{x:CANAL.bridgeX,z:41}).length,0);
  assert.ok(findPath(SPAWN,{x:3.2,z:31}).length);
});

test('canal safely borrows one reflection, pauses waves, restores visibility even on failure',()=>{
  const mirror=new Reflector(new T.PlaneGeometry(1,1)),normal=new T.Texture();
  let receiver,calls=0;const old=function(){calls++;assert.equal(receiver.visible,false);};mirror.onBeforeRender=old;
  const effect=createCanalWater(normal,mirror,false);receiver=effect.water;
  mirror.onBeforeRender();assert.equal(calls,1);assert.equal(receiver.visible,true);
  effect.update(3,true,false);assert.equal(receiver.material.uniforms.waterTime.value,3);
  effect.update(4,false,true);assert.equal(receiver.material.uniforms.waterTime.value,0);assert.equal(receiver.material.uniforms.useReflection.value,0);
  effect.detach();assert.equal(mirror.onBeforeRender,old);
  mirror.onBeforeRender=()=>{throw new Error('test render failure');};
  const second=createCanalWater(normal,mirror,true);assert.throws(()=>mirror.onBeforeRender(),/test render failure/);assert.equal(second.water.visible,true);
  second.detach();receiver.geometry.dispose();receiver.material.dispose();second.water.geometry.dispose();second.water.material.dispose();normal.dispose();mirror.dispose();mirror.geometry.dispose();
});

test('canal releases its assets once, retains borrowed reflection, and detaches its hook',async()=>{
  const model=fixture(),normal=new T.Texture(),scene=new T.Scene(),mirror=new Reflector(new T.PlaneGeometry(1,1));
  const old=mirror.onBeforeRender,counts=watch([...model.resources,normal]),borrowed=watch([mirror.getRenderTarget().texture]);
  const errors=[];const canal=createCanal(scene,{loadAsync:async()=>model},false,mirror,e=>errors.push(e),async()=>normal);
  await canal.ready;assert.deepEqual(errors,[]);assert.notEqual(mirror.onBeforeRender,old);
  let instances=0;canal.root.traverse(o=>{if(o.isInstancedMesh)instances++;});assert.equal(instances,roots.length+9);
  canal.dispose();canal.dispose();assert.ok(counts.every(c=>c.n===1));assert.equal(borrowed[0].n,0);assert.equal(mirror.onBeforeRender,old);assert.equal(scene.children.length,0);
  mirror.dispose();mirror.geometry.dispose();
});

test('late canal resources and a partial load failure clean up without reattaching',async()=>{
  let finish;const promise=new Promise(r=>finish=r),model=fixture(),normal=new T.Texture(),counts=watch([...model.resources,normal]);
  const mirror=new Reflector(new T.PlaneGeometry(1,1)),scene=new T.Scene();
  const canal=createCanal(scene,{loadAsync:()=>promise},true,mirror,()=>assert.fail('late error'),async()=>normal);
  canal.dispose();finish(model);await canal.ready;assert.ok(counts.every(c=>c.n===1));assert.equal(scene.children.length,0);
  const failedNormal=new T.Texture(),failedCount=watch([failedNormal]),errors=[];
  const failed=createCanal(scene,{loadAsync:async()=>{throw new Error('offline');}},true,mirror,e=>errors.push(e),async()=>failedNormal);
  await failed.ready;assert.equal(errors.length,1);failed.dispose();assert.equal(failedCount[0].n,1);
  mirror.dispose();mirror.geometry.dispose();
});
